const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  AttachmentBuilder
} = require('discord.js');
const { getGuildConfig } = require('../database/store');
const { getTicketType, validateConfiguration } = require('../services/configService');
const { hasCompletedQuestionnaire, beginQuestionnaire } = require('../services/questionnaireService');
const {
  createTicket,
  getTicketByUid,
  setClaimed,
  markUserExited,
  addTicketMember,
  removeTicketMember,
  addInternalNote,
  markClosing,
  rollbackClosing,
  markClosed,
  updateTicket,
  syncCallMemberPermission
} = require('../services/ticketService');
const { canManageTicket, memberHasAnyRole } = require('../utils/permissions');
const { ticketCreatedEphemeral } = require('../panels/ticketPanel');
const { sendLog } = require('../services/logService');
const { buildTranscript } = require('../utils/transcript');
const { sendRatingPrompt } = require('../services/ratingService');
const { buildVariables, renderTemplate, renderChannelName } = require('../utils/variables');
const { colorInt, truncate } = require('../utils/discord');

const EPHEMERAL = MessageFlags.Ephemeral;

function modalInput(id, label, value = '', required = true, max = 1000) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label.slice(0, 45))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(required)
    .setMaxLength(max);
  if (value) input.setValue(String(value).slice(0, max));
  return new ActionRowBuilder().addComponents(input);
}

async function loadTicketContext(interaction, uid) {
  const ticket = await getTicketByUid(uid);
  if (!ticket || ticket.guildId !== interaction.guildId) return { error: 'Ticket não encontrado.' };
  const config = await getGuildConfig(interaction.guildId);
  const type = getTicketType(config, ticket.typeId);
  return { ticket, config, type };
}

async function ensureStaff(interaction, ctx) {
  if (!await canManageTicket(interaction, ctx.type)) {
    await interaction.reply({ content: '❌ Este controle é exclusivo para a equipe responsável.', flags: EPHEMERAL });
    return false;
  }
  return true;
}

function isTicketActive(ticket) {
  return ticket?.status === 'open';
}

async function rejectInactive(interaction, ticket) {
  const label = ticket?.status === 'closing' ? 'está sendo finalizado' : 'já foi finalizado';
  const payload = { content: `⚠️ Este ticket ${label}. Os controles antigos foram bloqueados.`, flags: EPHEMERAL };
  if (interaction.isMessageComponent()) return interaction.reply(payload);
  return interaction.reply(payload);
}

async function disableTicketControls(channel) {
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!messages) return;

  for (const message of messages.values()) {
    if (!message.author?.bot || !message.components?.length) continue;
    const rows = message.components.map(row => {
      const json = row.toJSON();
      json.components = json.components.map(component => {
        if (component.custom_id?.startsWith('ticket:')) return { ...component, disabled: true };
        return component;
      });
      return json;
    });
    const changed = rows.some((row, rowIndex) =>
      row.components.some((component, componentIndex) =>
        component.disabled !== message.components[rowIndex]?.components?.[componentIndex]?.disabled
      )
    );
    if (changed) await message.edit({ components: rows }).catch(() => null);
  }
}

async function handleTicketCreateSelect(interaction) {
  if (!interaction.customId.startsWith('ticket:create:')) return false;
  const config = await getGuildConfig(interaction.guildId);
  const validation = await validateConfiguration(interaction.guild, config);
  if (!validation.ok) {
    return interaction.reply({
      content: '⚠️ O sistema de tickets está temporariamente incompleto. Avise a administração para usar `/config`.',
      flags: EPHEMERAL
    });
  }

  const typeId = interaction.values[0];
  const type = getTicketType(config, typeId);
  if (!type?.enabled) {
    return interaction.reply({ content: '❌ Essa opção de atendimento não está mais disponível.', flags: EPHEMERAL });
  }

  const requiresQuestionnaire = config.questionnaire.enabled
    && config.questionnaire.requiredBeforeTicket
    && type.requireQuestionnaire !== false;

  if (requiresQuestionnaire && !await hasCompletedQuestionnaire(interaction.guildId, interaction.user.id)) {
    const payload = await beginQuestionnaire(interaction.guildId, interaction.user.id, typeId);
    const clean = { ...payload };
    delete clean.ephemeral;
    return interaction.reply({ ...clean, flags: EPHEMERAL });
  }

  try {
    await interaction.deferReply({ flags: EPHEMERAL });
    const created = await createTicket(interaction.guild, interaction.user, typeId);
    return interaction.editReply(ticketCreatedEphemeral(config, created.ticket, created.channel, created.type));
  } catch (error) {
    const payload = { content: `❌ ${error.message}`, embeds: [], components: [] };
    if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => null);
    return interaction.reply({ ...payload, flags: EPHEMERAL });
  }
}

async function handleTicketButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('ticket:')) return false;
  const parts = id.split(':');
  const action = parts[1];
  const uid = parts[2];
  const ctx = await loadTicketContext(interaction, uid);
  if (ctx.error) return interaction.reply({ content: `❌ ${ctx.error}`, flags: EPHEMERAL });
  const { ticket, config, type } = ctx;

  if (action !== 'dmhelp' && !isTicketActive(ticket)) return rejectInactive(interaction, ticket);

  if (action === 'dmhelp') {
    return interaction.reply({
      content: '📩 **Como liberar sua DM:** abra as configurações de privacidade do servidor e permita **Mensagens diretas de membros do servidor**. Se sua DM continuar bloqueada, o bot ainda registrará o transcript nos logs configurados.',
      flags: EPHEMERAL
    });
  }

  if (action === 'userexit') {
    if (interaction.user.id !== ticket.userId) {
      return interaction.reply({ content: 'Apenas quem abriu o ticket pode usar essa opção.', flags: EPHEMERAL });
    }

    const embed = new EmbedBuilder()
      .setColor(0xF5A300)
      .setTitle('⚠️ Sair do Ticket')
      .setDescription([
        '**Tem certeza que deseja sair deste ticket?**',
        '',
        '🚨 **Atenção:**',
        '• Você não poderá abrir outro ticket enquanto este estiver aberto, de acordo com a regra configurada.',
        '• O ticket permanecerá ativo até um staff finalizar.',
        '• Você perderá acesso ao canal, mas o atendimento continuará aberto.',
        '• Esta regra ajuda a evitar spam de tickets.',
        '',
        '**Deseja realmente sair?**'
      ].join('\n'));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket:exitconfirm:${uid}:yes`).setLabel('Sim, Sair do Ticket').setEmoji('✅').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket:exitconfirm:${uid}:no`).setLabel('Não, Continuar no Ticket').setEmoji('❌').setStyle(ButtonStyle.Secondary)
    );
    return interaction.reply({ embeds: [embed], components: [row], flags: EPHEMERAL });
  }

  if (action === 'exitconfirm') {
    if (interaction.user.id !== ticket.userId) {
      return interaction.reply({ content: 'Apenas o dono do ticket pode confirmar.', flags: EPHEMERAL });
    }
    if (parts[3] === 'no') {
      return interaction.update({ content: '✅ Você continuará no ticket.', embeds: [], components: [] });
    }

    await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: false }, { reason: 'Usuário optou por sair do ticket' });
    await syncCallMemberPermission(interaction.guild, ticket, ticket.userId, false);
    await markUserExited(uid);
    await sendLog(interaction.guild, 'ticket_user_exit', {
      ticket,
      ticketType: type,
      title: '🚪 Usuário saiu do ticket',
      description: `<@${ticket.userId}> saiu de <#${ticket.channelId}>. O ticket permanece aberto.`
    });
    await interaction.channel.send({
      content: renderTemplate(config.templates.userExitText, buildVariables({
        guild: interaction.guild,
        ticket,
        ticketType: type,
        channel: interaction.channel,
        config
      }))
    }).catch(() => null);
    return interaction.update({ content: '✅ Você saiu do ticket. A equipe ainda poderá finalizar o atendimento.', embeds: [], components: [] });
  }

  if (!await ensureStaff(interaction, ctx)) return true;

  if (action === 'callmember' || action === 'addmember' || action === 'removemember') {
    const labels = {
      callmember: 'Escolha quem deseja chamar',
      addmember: 'Escolha quem deseja adicionar',
      removemember: 'Escolha quem deseja remover'
    };
    const menu = new UserSelectMenuBuilder()
      .setCustomId(`ticket:${action}sel:${uid}`)
      .setPlaceholder(labels[action])
      .setMinValues(1)
      .setMaxValues(1);
    return interaction.reply({ content: labels[action], components: [new ActionRowBuilder().addComponents(menu)], flags: EPHEMERAL });
  }

  if (action === 'presetmod' || action === 'presetresult') {
    const kind = action === 'presetmod' ? 'moderation' : 'results';
    const presets = config.presets[kind] || [];
    if (!presets.length) return interaction.reply({ content: 'Nenhum preset configurado.', flags: EPHEMERAL });
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`ticket:presetselect:${uid}:${kind}`)
      .setPlaceholder('Selecione o preset')
      .addOptions(presets.slice(0, 25).map(p => ({
        label: truncate(p.label, 100),
        value: p.id,
        description: truncate(p.text, 100)
      })));
    return interaction.reply({
      content: 'Escolha o preset que será enviado no ticket:',
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: EPHEMERAL
    });
  }

  if (action === 'move') {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(`ticket:movesel:${uid}`)
      .setPlaceholder('Nova categoria do ticket')
      .setChannelTypes(ChannelType.GuildCategory)
      .setMinValues(1)
      .setMaxValues(1);
    return interaction.reply({ content: 'Escolha a categoria de destino:', components: [new ActionRowBuilder().addComponents(menu)], flags: EPHEMERAL });
  }

  if (action === 'rename') {
    const modal = new ModalBuilder()
      .setCustomId(`ticket:renamesubmit:${uid}`)
      .setTitle('Trocar nome do canal')
      .addComponents(modalInput('name', 'Novo nome/modelo', interaction.channel.name, true, 100));
    return interaction.showModal(modal);
  }

  if (action === 'note') {
    const modal = new ModalBuilder()
      .setCustomId(`ticket:notesubmit:${uid}`)
      .setTitle('Observação interna')
      .addComponents(modalInput('note', 'Observação (somente staff/log)', '', true, 1500));
    return interaction.showModal(modal);
  }

  if (action === 'createcall') {
    if (ticket.callChannelId) {
      const existing = interaction.guild.channels.cache.get(ticket.callChannelId)
        || await interaction.guild.channels.fetch(ticket.callChannelId).catch(() => null);
      if (existing) return interaction.reply({ content: `🎙️ Este ticket já possui uma call: ${existing}`, flags: EPHEMERAL });
      await updateTicket(uid, { callChannelId: null });
    }

    const staffIds = [...new Set([...(config.permissions.staffRoleIds || []), ...(type?.staffRoleIds || [])])];
    const voiceAllow = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream];
    const overwrites = [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: ticket.userId, allow: voiceAllow },
      { id: interaction.guild.members.me.id, allow: [...voiceAllow, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
      ...staffIds.map(roleId => ({ id: roleId, allow: voiceAllow }))
    ];
    for (const memberId of ticket.addedMembers || []) overwrites.push({ id: memberId, allow: voiceAllow });

    const vars = buildVariables({
      guild: interaction.guild,
      ticket,
      ticketType: type,
      channel: interaction.channel,
      staff: interaction.user,
      config
    });

    const call = await interaction.guild.channels.create({
      name: renderChannelName(config.ticket.callNameTemplate, vars),
      type: ChannelType.GuildVoice,
      parent: interaction.channel.parentId || undefined,
      permissionOverwrites: overwrites,
      reason: `Call do ticket #${ticket.number}`
    });
    await updateTicket(uid, { callChannelId: call.id });
    await sendLog(interaction.guild, 'call_create', {
      ticket,
      ticketType: type,
      title: '🎙️ Call criada',
      description: `${interaction.user} criou ${call} para o ticket.`
    });
    await interaction.channel.send({ content: `🎙️ **Call de atendimento criada:** ${call}` });
    return interaction.reply({ content: `✅ Call criada: ${call}`, flags: EPHEMERAL });
  }

  if (action === 'claim') {
    if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
      return interaction.reply({ content: `⚠️ Este atendimento já foi assumido por <@${ticket.claimedBy}>.`, flags: EPHEMERAL });
    }
    await setClaimed(uid, interaction.user.id);
    const vars = buildVariables({
      guild: interaction.guild,
      ticket: { ...ticket, claimedBy: interaction.user.id },
      ticketType: type,
      channel: interaction.channel,
      staff: interaction.user,
      config
    });
    await interaction.channel.send({ content: renderTemplate(config.templates.claimText, vars) });
    await sendLog(interaction.guild, 'ticket_claim', {
      ticket: { ...ticket, claimedBy: interaction.user.id },
      ticketType: type,
      title: '😉 Atendimento assumido',
      description: `${interaction.user} assumiu <#${ticket.channelId}>.`
    });
    return interaction.reply({ content: '✅ Atendimento assumido por você.', flags: EPHEMERAL });
  }

  if (action === 'greet') {
    const vars = buildVariables({
      guild: interaction.guild,
      ticket,
      ticketType: type,
      channel: interaction.channel,
      staff: interaction.user,
      config
    });
    await interaction.channel.send({ content: renderTemplate(config.templates.greetText, vars) });
    await sendLog(interaction.guild, 'greet', {
      ticket,
      ticketType: type,
      title: '👋 Saudação enviada',
      description: `${interaction.user} saudou <@${ticket.userId}>.`
    });
    return interaction.reply({ content: '✅ Saudação enviada.', flags: EPHEMERAL });
  }

  if (action === 'close') {
    const modal = new ModalBuilder()
      .setCustomId(`ticket:closesubmit:${uid}`)
      .setTitle('Finalizar ticket')
      .addComponents(modalInput('reason', 'Motivo/resultado do fechamento', '', true, 1000));
    return interaction.showModal(modal);
  }

  return false;
}

async function handleTicketSelect(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('ticket:') || id.startsWith('ticket:create:')) return false;
  const parts = id.split(':');
  const action = parts[1];
  const uid = parts[2];
  const ctx = await loadTicketContext(interaction, uid);
  if (ctx.error) return interaction.reply({ content: `❌ ${ctx.error}`, flags: EPHEMERAL });
  if (!isTicketActive(ctx.ticket)) return rejectInactive(interaction, ctx.ticket);
  if (!await ensureStaff(interaction, ctx)) return true;
  const { ticket, type, config } = ctx;

  if (action === 'callmembersel') {
    const userId = interaction.values[0];
    const target = await interaction.client.users.fetch(userId).catch(() => null);
    const url = `https://discord.com/channels/${interaction.guildId}/${ticket.channelId}`;

    // A menção funciona para quem já possui acesso; a DM serve como fallback.
    await interaction.channel.send({ content: `🔔 <@${userId}>, você foi chamado por ${interaction.user} para auxiliar neste atendimento.` });
    if (target) await target.send(`🔔 Você foi chamado para auxiliar no ticket #${String(ticket.number).padStart(4, '0')} do **${interaction.guild.name}**.\n${url}`).catch(() => null);
    return interaction.update({ content: `✅ <@${userId}> chamado.`, components: [] });
  }

  if (action === 'addmembersel') {
    const userId = interaction.values[0];
    await interaction.channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true
    }, { reason: `Adicionado por ${interaction.user.tag}` });
    await addTicketMember(uid, userId);
    await syncCallMemberPermission(interaction.guild, ticket, userId, true);
    await sendLog(interaction.guild, 'member_add', {
      ticket,
      ticketType: type,
      title: '➕ Membro adicionado',
      description: `${interaction.user} adicionou <@${userId}> ao ticket.`
    });
    await interaction.channel.send({ content: `➕ <@${userId}> foi adicionado ao ticket por ${interaction.user}.` });
    return interaction.update({ content: `✅ <@${userId}> adicionado.`, components: [] });
  }

  if (action === 'removemembersel') {
    const userId = interaction.values[0];
    if (userId === ticket.userId) {
      return interaction.update({ content: '❌ Use o fluxo de saída do usuário; o dono do ticket não pode ser removido por este botão.', components: [] });
    }
    if (userId === interaction.client.user.id) {
      return interaction.update({ content: '❌ O bot não pode ser removido do próprio ticket.', components: [] });
    }

    const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);
    const protectedRoles = [
      ...(config.permissions.adminRoleIds || []),
      ...(config.permissions.staffRoleIds || []),
      ...(type?.staffRoleIds || [])
    ];
    if (targetMember && (
      targetMember.id === interaction.guild.ownerId
      || targetMember.permissions.has(PermissionFlagsBits.Administrator)
      || memberHasAnyRole(targetMember, protectedRoles)
    )) {
      return interaction.update({ content: '❌ Esse membro faz parte da equipe responsável. Remova o cargo/permissão correspondente em vez de aplicar um bloqueio individual.', components: [] });
    }

    await interaction.channel.permissionOverwrites.delete(userId, `Removido por ${interaction.user.tag}`).catch(async () => {
      await interaction.channel.permissionOverwrites.edit(userId, { ViewChannel: false }, { reason: `Removido por ${interaction.user.tag}` });
    });
    await removeTicketMember(uid, userId);
    await syncCallMemberPermission(interaction.guild, ticket, userId, false);
    await sendLog(interaction.guild, 'member_remove', {
      ticket,
      ticketType: type,
      title: '❌ Membro removido',
      description: `${interaction.user} removeu <@${userId}> do ticket.`
    });
    return interaction.update({ content: `✅ <@${userId}> removido.`, components: [] });
  }

  if (action === 'presetselect') {
    const kind = parts[3];
    const preset = (config.presets[kind] || []).find(p => p.id === interaction.values[0]);
    if (!preset) return interaction.update({ content: 'Preset não encontrado.', components: [] });
    await interaction.channel.send({
      content: renderTemplate(preset.text, buildVariables({
        guild: interaction.guild,
        ticket,
        ticketType: type,
        channel: interaction.channel,
        staff: interaction.user,
        config
      }))
    });
    return interaction.update({ content: `✅ Preset **${preset.label}** enviado.`, components: [] });
  }

  if (action === 'movesel') {
    const categoryId = interaction.values[0];
    await interaction.channel.setParent(categoryId, { lockPermissions: false, reason: `Ticket movido por ${interaction.user.tag}` });
    const freshTicket = await getTicketByUid(uid);
    if (freshTicket?.callChannelId) {
      const call = interaction.guild.channels.cache.get(freshTicket.callChannelId)
        || await interaction.guild.channels.fetch(freshTicket.callChannelId).catch(() => null);
      if (call) await call.setParent(categoryId, { lockPermissions: false, reason: 'Acompanhar categoria do ticket' }).catch(() => null);
    }
    await sendLog(interaction.guild, 'ticket_move', {
      ticket,
      ticketType: type,
      title: '🔄 Ticket movido',
      description: `${interaction.user} moveu o ticket para <#${categoryId}>.`
    });
    return interaction.update({ content: `✅ Ticket movido para <#${categoryId}>.`, components: [] });
  }
  return false;
}

async function handleTicketModal(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('ticket:')) return false;
  const parts = id.split(':');
  const action = parts[1];
  const uid = parts[2];
  const ctx = await loadTicketContext(interaction, uid);
  if (ctx.error) return interaction.reply({ content: `❌ ${ctx.error}`, flags: EPHEMERAL });
  if (!isTicketActive(ctx.ticket)) return rejectInactive(interaction, ctx.ticket);
  if (!await ensureStaff(interaction, ctx)) return true;
  const { ticket, config, type } = ctx;

  if (action === 'renamesubmit') {
    const raw = interaction.fields.getTextInputValue('name').trim();
    const vars = buildVariables({
      guild: interaction.guild,
      ticket,
      ticketType: type,
      channel: interaction.channel,
      staff: interaction.user,
      config
    });
    const name = renderChannelName(raw, vars);
    await interaction.channel.setName(name, `Renomeado por ${interaction.user.tag}`);
    await updateTicket(uid, { channelName: name });
    await sendLog(interaction.guild, 'ticket_rename', {
      ticket,
      ticketType: type,
      title: '📝 Canal renomeado',
      description: `${interaction.user} alterou o canal para \`${name}\`.`
    });
    return interaction.reply({ content: `✅ Canal renomeado para **${name}**.`, flags: EPHEMERAL });
  }

  if (action === 'notesubmit') {
    const note = interaction.fields.getTextInputValue('note').trim();
    await addInternalNote(uid, note, interaction.user.id);
    await sendLog(interaction.guild, 'internal_note', {
      ticket,
      ticketType: type,
      title: '🗒️ Observação interna',
      description: `**Staff:** ${interaction.user}\n**Nota:** ${note}`
    });
    return interaction.reply({ content: '✅ Observação salva no histórico interno e no log configurado.', flags: EPHEMERAL });
  }

  if (action === 'closesubmit') {
    if (ticket.status !== 'open') {
      return interaction.reply({ content: '⚠️ Este ticket já está sendo finalizado.', flags: EPHEMERAL });
    }

    const reason = interaction.fields.getTextInputValue('reason').trim();
    await interaction.deferReply({ flags: EPHEMERAL });
    const closingTicket = await markClosing(uid, reason, interaction.user.id);

    try {
      let transcript = null;
      if (config.ticket.transcriptEnabled) {
        try {
          transcript = await buildTranscript(interaction.channel, closingTicket);
        } catch (error) {
          console.error('Transcript:', error);
        }
      }

      const vars = buildVariables({
        guild: interaction.guild,
        ticket: closingTicket,
        ticketType: type,
        channel: interaction.channel,
        staff: interaction.user,
        reason,
        config
      });

      const closeEmbed = new EmbedBuilder()
        .setColor(colorInt(config.branding.color))
        .setTitle(renderTemplate(config.templates.closeLogTitle, vars))
        .setDescription(`**Ticket:** #${String(ticket.number).padStart(4, '0')}\n**Usuário:** <@${ticket.userId}>\n**Finalizado por:** ${interaction.user}\n**Motivo:** ${reason}`)
        .setTimestamp();
      await interaction.channel.send({ embeds: [closeEmbed] }).catch(() => null);

      await sendLog(interaction.guild, 'ticket_close', {
        ticket: closingTicket,
        ticketType: type,
        title: '🔒 Ticket finalizado',
        description: `**Canal:** <#${ticket.channelId}>\n**Usuário:** <@${ticket.userId}>\n**Staff:** ${interaction.user}\n**Tipo:** ${type?.name || ticket.typeName}\n**Motivo:** ${reason}`,
        file: transcript ? { buffer: transcript.buffer, name: transcript.name } : null
      });

      const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
      if (user && config.ticket.dmTranscript) {
        const dmPayload = { content: renderTemplate(config.templates.closeDmText, vars) };
        if (transcript) dmPayload.files = [new AttachmentBuilder(transcript.buffer, { name: transcript.name })];
        await user.send(dmPayload).catch(() => null);
      }

      let ratingResult = { ticket: false, dm: false, sent: false, mode: 'off' };
      if (user) ratingResult = await sendRatingPrompt(interaction.guild, closingTicket, type, interaction.channel, user);

      let delay = Math.max(0, Number(config.ticket.deleteAfterCloseSeconds) || 0);
      if (ratingResult.ticket) delay = Math.max(30, Number(config.rating.ticketTimeoutSeconds) || 300);
      const deleteAt = new Date(Date.now() + delay * 1000).toISOString();
      await markClosed(uid, deleteAt);
      await disableTicketControls(interaction.channel);

      return interaction.editReply({
        content: `✅ Ticket finalizado. Transcript ${transcript ? 'gerado' : 'não gerado'} e avaliação ${ratingResult.sent ? 'enviada' : 'não enviada'}. O canal será removido ${ratingResult.ticket ? `após a avaliação ou em até ${delay}s` : `em aproximadamente ${delay}s`}.`
      });
    } catch (error) {
      await rollbackClosing(uid).catch(() => null);
      console.error(`Falha ao finalizar ticket ${uid}:`, error);
      return interaction.editReply({
        content: `❌ Não foi possível concluir o fechamento. O ticket foi reaberto automaticamente para evitar ficar preso.\n\`${String(error.message || error).slice(0, 1200)}\``
      });
    }
  }

  return false;
}

module.exports = {
  handleTicketCreateSelect,
  handleTicketButton,
  handleTicketSelect,
  handleTicketModal,
  disableTicketControls
};
