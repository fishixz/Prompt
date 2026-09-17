const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
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
  markClosed,
  updateTicket
} = require('../services/ticketService');
const { canManageTicket } = require('../utils/permissions');
const { ticketCreatedEphemeral } = require('../panels/ticketPanel');
const { sendLog } = require('../services/logService');
const { buildTranscript } = require('../utils/transcript');
const { sendRatingPrompt } = require('../services/ratingService');
const { buildVariables, renderTemplate, renderChannelName } = require('../utils/variables');
const { colorInt, truncate } = require('../utils/discord');

function modalInput(id, label, value = '', required = true, max = 1000) {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label.slice(0,45)).setStyle(TextInputStyle.Paragraph).setRequired(required).setMaxLength(max);
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
    await interaction.reply({ content: '❌ Este controle é exclusivo para a equipe responsável.', ephemeral: true });
    return false;
  }
  return true;
}

async function handleTicketCreateSelect(interaction) {
  if (!interaction.customId.startsWith('ticket:create:')) return false;
  const config = await getGuildConfig(interaction.guildId);
  const validation = await validateConfiguration(interaction.guild, config);
  if (!validation.ok) {
    return interaction.reply({ content: '⚠️ O sistema de tickets está temporariamente incompleto. Avise a administração para usar `/config`.', ephemeral: true });
  }
  const typeId = interaction.values[0];
  const type = getTicketType(config, typeId);
  if (!type?.enabled) return interaction.reply({ content: '❌ Essa opção de atendimento não está mais disponível.', ephemeral: true });

  const requiresQuestionnaire = config.questionnaire.enabled && config.questionnaire.requiredBeforeTicket && type.requireQuestionnaire !== false;
  if (requiresQuestionnaire && !await hasCompletedQuestionnaire(interaction.guildId, interaction.user.id)) {
    const payload = await beginQuestionnaire(interaction.guildId, interaction.user.id, typeId);
    return interaction.reply(payload);
  }

  try {
    await interaction.deferReply({ ephemeral: true });
    const created = await createTicket(interaction.guild, interaction.user, typeId);
    return interaction.editReply(ticketCreatedEphemeral(config, created.ticket, created.channel, created.type));
  } catch (error) {
    return interaction.editReply({ content: `❌ ${error.message}`, embeds: [], components: [] }).catch(() => interaction.reply({ content: `❌ ${error.message}`, ephemeral: true }));
  }
}

async function handleTicketButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('ticket:')) return false;
  const parts = id.split(':');
  const action = parts[1];
  const uid = parts[2];
  const ctx = await loadTicketContext(interaction, uid);
  if (ctx.error) return interaction.reply({ content: `❌ ${ctx.error}`, ephemeral: true });
  const { ticket, config, type } = ctx;

  if (action === 'dmhelp') {
    return interaction.reply({
      content: '📩 **Como liberar sua DM:** abra as configurações de privacidade do servidor e permita **Mensagens diretas de membros do servidor**. Se sua DM continuar bloqueada, o bot ainda registrará o transcript nos logs configurados.',
      ephemeral: true
    });
  }

  if (action === 'userexit') {
    if (interaction.user.id !== ticket.userId) return interaction.reply({ content: 'Apenas quem abriu o ticket pode usar essa opção.', ephemeral: true });
    const embed = new EmbedBuilder().setColor(0xF5A300).setTitle('⚠️ Sair do Ticket').setDescription([
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
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  if (action === 'exitconfirm') {
    if (interaction.user.id !== ticket.userId) return interaction.reply({ content: 'Apenas o dono do ticket pode confirmar.', ephemeral: true });
    if (parts[3] === 'no') return interaction.update({ content: '✅ Você continuará no ticket.', embeds: [], components: [] });
    await interaction.channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: false }, { reason: 'Usuário optou por sair do ticket' });
    await markUserExited(uid);
    await sendLog(interaction.guild, 'ticket_user_exit', { ticket, ticketType: type, title: '🚪 Usuário saiu do ticket', description: `<@${ticket.userId}> saiu de <#${ticket.channelId}>. O ticket permanece aberto.` });
    await interaction.channel.send({ content: renderTemplate(config.templates.userExitText, buildVariables({ guild: interaction.guild, ticket, ticketType: type, channel: interaction.channel, config })) }).catch(() => null);
    return interaction.update({ content: '✅ Você saiu do ticket. A equipe ainda poderá finalizar o atendimento.', embeds: [], components: [] });
  }

  if (!await ensureStaff(interaction, ctx)) return true;

  if (action === 'callmember' || action === 'addmember' || action === 'removemember') {
    const labels = { callmember: 'Escolha quem deseja chamar', addmember: 'Escolha quem deseja adicionar', removemember: 'Escolha quem deseja remover' };
    const menu = new UserSelectMenuBuilder().setCustomId(`ticket:${action}sel:${uid}`).setPlaceholder(labels[action]).setMinValues(1).setMaxValues(1);
    return interaction.reply({ content: labels[action], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  }

  if (action === 'presetmod' || action === 'presetresult') {
    const kind = action === 'presetmod' ? 'moderation' : 'results';
    const presets = config.presets[kind] || [];
    if (!presets.length) return interaction.reply({ content: 'Nenhum preset configurado.', ephemeral: true });
    const menu = new StringSelectMenuBuilder().setCustomId(`ticket:presetselect:${uid}:${kind}`).setPlaceholder('Selecione o preset').addOptions(presets.slice(0,25).map(p => ({ label: truncate(p.label,100), value: p.id, description: truncate(p.text,100) })));
    return interaction.reply({ content: 'Escolha o preset que será enviado no ticket:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  }

  if (action === 'move') {
    const menu = new ChannelSelectMenuBuilder().setCustomId(`ticket:movesel:${uid}`).setPlaceholder('Nova categoria do ticket').setChannelTypes(ChannelType.GuildCategory).setMinValues(1).setMaxValues(1);
    return interaction.reply({ content: 'Escolha a categoria de destino:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  }

  if (action === 'rename') {
    const modal = new ModalBuilder().setCustomId(`ticket:renamesubmit:${uid}`).setTitle('Trocar nome do canal').addComponents(modalInput('name', 'Novo nome/modelo', interaction.channel.name, true, 100));
    return interaction.showModal(modal);
  }

  if (action === 'note') {
    const modal = new ModalBuilder().setCustomId(`ticket:notesubmit:${uid}`).setTitle('Observação interna').addComponents(modalInput('note', 'Observação (somente staff/log)', '', true, 1500));
    return interaction.showModal(modal);
  }

  if (action === 'createcall') {
    if (ticket.callChannelId) {
      const existing = interaction.guild.channels.cache.get(ticket.callChannelId);
      if (existing) return interaction.reply({ content: `🎙️ Este ticket já possui uma call: ${existing}`, ephemeral: true });
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
    const vars = buildVariables({ guild: interaction.guild, ticket, ticketType: type, channel: interaction.channel, staff: interaction.user, config });
    const call = await interaction.guild.channels.create({
      name: renderChannelName(config.ticket.callNameTemplate, vars),
      type: ChannelType.GuildVoice,
      parent: interaction.channel.parentId || undefined,
      permissionOverwrites: overwrites,
      reason: `Call do ticket #${ticket.number}`
    });
    await updateTicket(uid, { callChannelId: call.id });
    await sendLog(interaction.guild, 'call_create', { ticket, ticketType: type, title: '🎙️ Call criada', description: `${interaction.user} criou ${call} para o ticket.` });
    await interaction.channel.send({ content: `🎙️ **Call de atendimento criada:** ${call}` });
    return interaction.reply({ content: `✅ Call criada: ${call}`, ephemeral: true });
  }

  if (action === 'claim') {
    if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) return interaction.reply({ content: `⚠️ Este atendimento já foi assumido por <@${ticket.claimedBy}>.`, ephemeral: true });
    await setClaimed(uid, interaction.user.id);
    const vars = buildVariables({ guild: interaction.guild, ticket: { ...ticket, claimedBy: interaction.user.id }, ticketType: type, channel: interaction.channel, staff: interaction.user, config });
    await interaction.channel.send({ content: renderTemplate(config.templates.claimText, vars) });
    await sendLog(interaction.guild, 'ticket_claim', { ticket: { ...ticket, claimedBy: interaction.user.id }, ticketType: type, title: '😉 Atendimento assumido', description: `${interaction.user} assumiu <#${ticket.channelId}>.` });
    return interaction.reply({ content: '✅ Atendimento assumido por você.', ephemeral: true });
  }

  if (action === 'greet') {
    const vars = buildVariables({ guild: interaction.guild, ticket, ticketType: type, channel: interaction.channel, staff: interaction.user, config });
    await interaction.channel.send({ content: renderTemplate(config.templates.greetText, vars) });
    await sendLog(interaction.guild, 'greet', { ticket, ticketType: type, title: '👋 Saudação enviada', description: `${interaction.user} saudou <@${ticket.userId}>.` });
    return interaction.reply({ content: '✅ Saudação enviada.', ephemeral: true });
  }

  if (action === 'close') {
    const modal = new ModalBuilder().setCustomId(`ticket:closesubmit:${uid}`).setTitle('Finalizar ticket').addComponents(modalInput('reason', 'Motivo/resultado do fechamento', '', true, 1000));
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
  if (ctx.error) return interaction.reply({ content: `❌ ${ctx.error}`, ephemeral: true });
  if (!await ensureStaff(interaction, ctx)) return true;
  const { ticket, type, config } = ctx;

  if (action === 'callmembersel') {
    const userId = interaction.values[0];
    await interaction.channel.send({ content: `🔔 <@${userId}>, você foi chamado por ${interaction.user} para auxiliar neste atendimento.` });
    return interaction.update({ content: `✅ <@${userId}> chamado.`, components: [] });
  }
  if (action === 'addmembersel') {
    const userId = interaction.values[0];
    await interaction.channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }, { reason: `Adicionado por ${interaction.user.tag}` });
    await addTicketMember(uid, userId);
    await sendLog(interaction.guild, 'member_add', { ticket, ticketType: type, title: '➕ Membro adicionado', description: `${interaction.user} adicionou <@${userId}> ao ticket.` });
    await interaction.channel.send({ content: `➕ <@${userId}> foi adicionado ao ticket por ${interaction.user}.` });
    return interaction.update({ content: `✅ <@${userId}> adicionado.`, components: [] });
  }
  if (action === 'removemembersel') {
    const userId = interaction.values[0];
    if (userId === ticket.userId) return interaction.update({ content: '❌ Use o fluxo de saída do usuário; o dono do ticket não pode ser removido por este botão.', components: [] });
    await interaction.channel.permissionOverwrites.edit(userId, { ViewChannel: false }, { reason: `Removido por ${interaction.user.tag}` });
    await removeTicketMember(uid, userId);
    await sendLog(interaction.guild, 'member_remove', { ticket, ticketType: type, title: '❌ Membro removido', description: `${interaction.user} removeu <@${userId}> do ticket.` });
    return interaction.update({ content: `✅ <@${userId}> removido.`, components: [] });
  }
  if (action === 'presetselect') {
    const kind = parts[3];
    const preset = (config.presets[kind] || []).find(p => p.id === interaction.values[0]);
    if (!preset) return interaction.update({ content: 'Preset não encontrado.', components: [] });
    await interaction.channel.send({ content: renderTemplate(preset.text, buildVariables({ guild: interaction.guild, ticket, ticketType: type, channel: interaction.channel, staff: interaction.user, config })) });
    return interaction.update({ content: `✅ Preset **${preset.label}** enviado.`, components: [] });
  }
  if (action === 'movesel') {
    const categoryId = interaction.values[0];
    await interaction.channel.setParent(categoryId, { lockPermissions: false, reason: `Ticket movido por ${interaction.user.tag}` });
    await sendLog(interaction.guild, 'ticket_move', { ticket, ticketType: type, title: '🔄 Ticket movido', description: `${interaction.user} moveu o ticket para <#${categoryId}>.` });
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
  if (ctx.error) return interaction.reply({ content: `❌ ${ctx.error}`, ephemeral: true });
  if (!await ensureStaff(interaction, ctx)) return true;
  const { ticket, config, type } = ctx;

  if (action === 'renamesubmit') {
    const raw = interaction.fields.getTextInputValue('name').trim();
    const vars = buildVariables({ guild: interaction.guild, ticket, ticketType: type, channel: interaction.channel, staff: interaction.user, config });
    const name = renderChannelName(raw, vars);
    await interaction.channel.setName(name, `Renomeado por ${interaction.user.tag}`);
    await updateTicket(uid, { channelName: name });
    await sendLog(interaction.guild, 'ticket_rename', { ticket, ticketType: type, title: '📝 Canal renomeado', description: `${interaction.user} alterou o canal para \`${name}\`.` });
    return interaction.reply({ content: `✅ Canal renomeado para **${name}**.`, ephemeral: true });
  }

  if (action === 'notesubmit') {
    const note = interaction.fields.getTextInputValue('note').trim();
    await addInternalNote(uid, note, interaction.user.id);
    await sendLog(interaction.guild, 'internal_note', { ticket, ticketType: type, title: '🗒️ Observação interna', description: `**Staff:** ${interaction.user}\n**Nota:** ${note}` });
    return interaction.reply({ content: '✅ Observação salva no histórico interno e no log configurado.', ephemeral: true });
  }

  if (action === 'closesubmit') {
    if (ticket.status !== 'open') return interaction.reply({ content: '⚠️ Este ticket já está sendo finalizado.', ephemeral: true });
    const reason = interaction.fields.getTextInputValue('reason').trim();
    await interaction.deferReply({ ephemeral: true });
    const closingTicket = await markClosing(uid, reason, interaction.user.id);

    let transcript = null;
    if (config.ticket.transcriptEnabled) {
      try { transcript = await buildTranscript(interaction.channel, closingTicket); } catch (error) { console.error('Transcript:', error); }
    }

    const vars = buildVariables({ guild: interaction.guild, ticket: closingTicket, ticketType: type, channel: interaction.channel, staff: interaction.user, reason, config });
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

    let delay = Number(config.ticket.deleteAfterCloseSeconds) || 3;
    if (ratingResult.ticket) delay = Math.max(30, Number(config.rating.ticketTimeoutSeconds) || 300);
    const deleteAt = new Date(Date.now() + delay * 1000).toISOString();
    await markClosed(uid, deleteAt);

    return interaction.editReply({ content: `✅ Ticket finalizado. Transcript ${transcript ? 'gerado' : 'não gerado'} e avaliação ${ratingResult.sent ? 'enviada' : 'não enviada'}. O canal será removido ${ratingResult.ticket ? `após a avaliação ou em até ${delay}s` : `em aproximadamente ${delay}s`}.` });
  }
  return false;
}

module.exports = {
  handleTicketCreateSelect,
  handleTicketButton,
  handleTicketSelect,
  handleTicketModal
};
