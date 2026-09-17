const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { panelMessage, ticketCreatedEphemeral, ticketOpeningMessages } = require('../panels/ticketPanel');
const { renderQuestionnaire } = require('./questionnaireService');
const { buildRatingPayload } = require('./ratingService');
const { buildVariables, renderTemplate } = require('../utils/variables');
const { colorInt, truncate } = require('../utils/discord');

function previewType(config, typeId = null) {
  const all = config.ticketTypes || [];
  return all.find(type => type.id === typeId)
    || all.find(type => type.enabled)
    || all[0]
    || {
      id: 'preview',
      name: 'Suporte',
      description: 'Atendimento de exemplo',
      emoji: '🎫',
      enabled: true,
      selectorId: 'principal',
      parentCategoryId: null,
      channelNameTemplate: config.ticket?.defaultNameTemplate || 'ticket-{ticket_type_slug}-{ticket_id}',
      staffRoleIds: [],
      requireQuestionnaire: true,
      logChannelIds: {}
    };
}

function previewTicket(config, guild, user, channel, typeId = null) {
  const type = previewType(config, typeId);
  const createdAt = new Date().toISOString();
  return {
    uid: 'preview-ticket',
    number: 1234,
    guildId: guild.id,
    userId: user.id,
    userName: user.username || 'usuario',
    userDisplay: user.globalName || user.username || 'Usuário',
    typeId: type.id,
    typeName: type.name,
    channelId: channel?.id || '000000000000000000',
    channelName: channel?.name || 'ticket-suporte-1234',
    claimedBy: user.id,
    claimedByName: user.username || 'staff',
    claimedByDisplay: user.globalName || user.username || 'Staff',
    status: 'open',
    createdAt
  };
}

function rawComponent(component) {
  return typeof component?.toJSON === 'function' ? component.toJSON() : { ...component };
}

function disableComponents(payload) {
  const components = (payload.components || []).map(row => {
    const rowJson = rawComponent(row);
    return {
      ...rowJson,
      components: (rowJson.components || []).map(component => ({ ...component, disabled: true }))
    };
  });
  return { ...payload, components };
}

function questionnairePreviewComponents(payload) {
  const components = (payload.components || []).map(row => {
    const rowJson = rawComponent(row);
    return {
      ...rowJson,
      components: (rowJson.components || []).map(component => {
        const customId = component.custom_id || '';
        if (customId.startsWith('q:page:')) {
          const page = customId.split(':').pop();
          return {
            ...component,
            custom_id: `configx:preview:qpage:${page}`,
            disabled: Boolean(component.disabled)
          };
        }
        return { ...component, disabled: true };
      })
    };
  });
  return { ...payload, components };
}

function previewMenu(config) {
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle('👁️ Central de Prévias • Rocha Ticket')
    .setDescription([
      'Veja como cada parte do sistema ficará **antes de publicar ou usar em um ticket real**.',
      '',
      'As ações perigosas ficam desativadas nas prévias. O questionário permite navegar entre as páginas sem salvar respostas.'
    ].join('\n'));

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('configx:preview:public').setLabel('Painel Público').setEmoji('🎨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('configx:preview:created').setLabel('Ticket Criado').setEmoji('✅').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('configx:preview:ticket').setLabel('Dentro do Ticket').setEmoji('🎫').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('configx:preview:questionnaire').setLabel('Questionário').setEmoji('🧠').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('configx:preview:rating').setLabel('Avaliação').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('configx:preview:close').setLabel('Finalização').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('configx:preview:logs').setLabel('Logs').setEmoji('📚').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('configx:preview:presets').setLabel('Presets').setEmoji('🧰').setStyle(ButtonStyle.Secondary)
    )
  ];

  const types = (config.ticketTypes || []).filter(type => type.enabled).slice(0, 25);
  if (types.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('configx:preview:tickettype')
        .setPlaceholder('Prévia do ticket usando um tipo específico')
        .addOptions(types.map(type => ({
          label: truncate(type.name, 100),
          value: type.id,
          description: truncate(type.description || 'Abrir prévia deste tipo', 100)
        })))
    ));
  }

  return { embeds: [embed], components: rows };
}

function buildPublicPreview(config, guild) {
  return disableComponents({
    content: '👁️ **Prévia do painel público** — nada abaixo executará ações.',
    ...panelMessage(config, guild)
  });
}

function buildCreatedPreview(config, guild, user, channel, typeId = null) {
  const type = previewType(config, typeId);
  const ticket = previewTicket(config, guild, user, channel, type.id);
  return disableComponents({
    content: `👁️ **Prévia da confirmação de criação** • ${type.name}`,
    ...ticketCreatedEphemeral(config, ticket, channel, type)
  });
}

function buildTicketPreview(config, guild, user, channel, typeId = null) {
  const type = previewType(config, typeId);
  const ticket = previewTicket(config, guild, user, channel, type.id);
  const messages = ticketOpeningMessages(config, ticket, type, channel, user);
  return disableComponents({
    content: `👁️ **Prévia completa de dentro do ticket** • ${type.name}`,
    embeds: messages.flatMap(message => message.embeds || []),
    components: messages.flatMap(message => message.components || [])
  });
}

function buildQuestionnairePreview(config, guild, user, page = 0) {
  const type = previewType(config);
  const pending = {
    guildId: guild.id,
    userId: user.id,
    typeId: type.id,
    page: Math.max(0, Number(page) || 0),
    answers: {},
    startedAt: new Date().toISOString()
  };
  const payload = renderQuestionnaire(config, pending);
  return questionnairePreviewComponents({
    content: '👁️ **Prévia do questionário** — navegue pelas páginas sem salvar respostas.',
    ...payload
  });
}

function buildRatingPreview(config, guild, user, channel, typeId = null) {
  const type = previewType(config, typeId);
  const ticket = previewTicket(config, guild, user, channel, type.id);
  return disableComponents({
    content: `👁️ **Prévia da avaliação** • escala 1–${config.rating.scale || 5}`,
    ...buildRatingPayload(config, guild, ticket, type)
  });
}

function buildClosePreview(config, guild, user, channel, typeId = null) {
  const type = previewType(config, typeId);
  const ticket = previewTicket(config, guild, user, channel, type.id);
  const reason = 'Atendimento concluído com sucesso. Este é apenas um exemplo de prévia.';
  const vars = buildVariables({ guild, user, ticket, ticketType: type, channel, staff: user, reason, config });

  const closeEmbed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle(renderTemplate(config.templates.closeLogTitle, vars))
    .setDescription([
      `**Ticket:** #${String(ticket.number).padStart(4, '0')}`,
      `**Usuário:** <@${ticket.userId}>`,
      `**Finalizado por:** <@${user.id}>`,
      `**Motivo:** ${reason}`
    ].join('\n'))
    .setTimestamp();

  const dmEmbed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle('📩 Prévia da mensagem enviada por DM')
    .setDescription(renderTemplate(config.templates.closeDmText, vars));

  return {
    content: '👁️ **Prévia da finalização do ticket**',
    embeds: [closeEmbed, dmEmbed],
    components: []
  };
}

function buildLogsPreview(config, guild, user, channel, typeId = null) {
  const type = previewType(config, typeId);
  const ticket = previewTicket(config, guild, user, channel, type.id);
  const footer = { text: `Ticket #${String(ticket.number).padStart(4, '0')} • ${ticket.uid}` };
  const color = colorInt(config.branding.color);

  const opened = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎫 Ticket aberto')
    .setDescription(`**Usuário:** <@${ticket.userId}>\n**Tipo:** ${type.name}\n**Canal:** <#${ticket.channelId}>`)
    .setFooter(footer)
    .setTimestamp();
  const claimed = new EmbedBuilder()
    .setColor(color)
    .setTitle('😉 Atendimento assumido')
    .setDescription(`<@${user.id}> assumiu <#${ticket.channelId}>.`)
    .setFooter(footer)
    .setTimestamp();
  const closed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🔒 Ticket finalizado')
    .setDescription(`**Usuário:** <@${ticket.userId}>\n**Staff:** <@${user.id}>\n**Tipo:** ${type.name}\n**Motivo:** Atendimento concluído.`)
    .setFooter(footer)
    .setTimestamp();

  return {
    content: '👁️ **Prévia de alguns logs do sistema**',
    embeds: [opened, claimed, closed],
    components: []
  };
}

function buildPresetsPreview(config, guild, user, channel, typeId = null) {
  const type = previewType(config, typeId);
  const ticket = previewTicket(config, guild, user, channel, type.id);
  const vars = buildVariables({ guild, user, ticket, ticketType: type, channel, staff: user, config });
  const moderation = (config.presets.moderation || []).slice(0, 5);
  const results = (config.presets.results || []).slice(0, 5);

  const modText = moderation.length
    ? moderation.map(item => `**${item.label}**\n${renderTemplate(item.text, vars)}`).join('\n\n')
    : '_Nenhum preset de moderação configurado._';
  const resultText = results.length
    ? results.map(item => `**${item.label}**\n${renderTemplate(item.text, vars)}`).join('\n\n')
    : '_Nenhum preset de resultado configurado._';

  const modEmbed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle('🧩 Presets de Moderação')
    .setDescription(truncate(modText, 4096));
  const resultEmbed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle('⚖️ Presets de Resultados')
    .setDescription(truncate(resultText, 4096));

  return {
    content: '👁️ **Prévia dos presets** — exibindo até 5 de cada grupo.',
    embeds: [modEmbed, resultEmbed],
    components: []
  };
}

module.exports = {
  previewMenu,
  previewType,
  previewTicket,
  disableComponents,
  buildPublicPreview,
  buildCreatedPreview,
  buildTicketPreview,
  buildQuestionnairePreview,
  buildRatingPreview,
  buildClosePreview,
  buildLogsPreview,
  buildPresetsPreview
};
