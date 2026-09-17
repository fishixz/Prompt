const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { colorInt, componentEmoji, chunk, truncate } = require('../utils/discord');
const { buildVariables, renderTemplate } = require('../utils/variables');

function panelMessage(config, guild = null) {
  let logo = config.branding.logoEmoji || ':rocha:';
  const named = /^:([a-zA-Z0-9_]+):$/.exec(logo);
  if (named && guild) {
    const emoji = guild.emojis.cache.find(e => e.name === named[1]);
    if (emoji) logo = emoji.toString();
  }
  const titleVars = { logo, panel_title: config.branding.title || 'Ticket | Rocha Roleplay' };
  const title = renderTemplate(config.panel.titleTemplate || '{logo} {panel_title}', titleVars);
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle(truncate(title, 256))
    .setDescription(truncate(config.panel.description, 4096));
  if (config.panel.bannerUrl) embed.setImage(config.panel.bannerUrl);
  if (config.branding.footer) embed.setFooter({ text: config.branding.footer });

  const rows = [];
  const activeTypes = (config.ticketTypes || []).filter(t => t.enabled);
  for (const selector of (config.panel.selectors || []).filter(s => s.enabled)) {
    const types = activeTypes.filter(t => t.selectorId === selector.id);
    for (const [index, typeChunk] of chunk(types, 25).entries()) {
      if (rows.length >= 5) break;
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`ticket:create:${selector.id}:${index}`)
        .setPlaceholder(index === 0 ? selector.placeholder : `${selector.name} • continuação ${index + 1}`)
        .addOptions(typeChunk.map(type => {
          const opt = {
            label: truncate(type.name, 100),
            value: type.id,
            description: truncate(type.description || 'Abrir atendimento', 100)
          };
          const emoji = componentEmoji(type.emoji);
          if (emoji) opt.emoji = emoji;
          return opt;
        }));
      rows.push(new ActionRowBuilder().addComponents(menu));
    }
  }
  return { embeds: [embed], components: rows };
}

function ticketCreatedEphemeral(config, ticket, channel, ticketType) {
  const vars = buildVariables({ guild: channel.guild, ticket, ticketType, channel, config });
  const embed = new EmbedBuilder()
    .setColor(0x20bf6b)
    .setTitle(renderTemplate(config.templates.createdSuccessTitle, vars))
    .setDescription(renderTemplate(config.templates.createdSuccessBody, vars));
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Clique aqui para acessar')
          .setEmoji('🔗')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${channel.guild.id}/${channel.id}`)
      )
    ]
  };
}

function ticketOpeningMessages(config, ticket, ticketType, channel, user) {
  const vars = buildVariables({ guild: channel.guild, user, ticket, ticketType, channel, config });
  const main = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle(renderTemplate(config.templates.ticketOpenTitle, vars))
    .setDescription(renderTemplate(config.templates.ticketOpenBody, vars));

  const userEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setDescription(renderTemplate(config.templates.userNotice, vars));

  const userRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:userexit:${ticket.uid}`).setLabel('Desejo sair ou cancelar esse ticket').setEmoji('🚪').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket:dmhelp:${ticket.uid}`).setLabel('Como libero minha DM?').setEmoji('❓').setStyle(ButtonStyle.Danger)
  );

  const staffEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setDescription('Opções exclusivas para o uso dos responsáveis pelo atendimento!');

  const staffRows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket:callmember:${ticket.uid}`).setLabel('Chamar Membro').setEmoji('🔔').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:addmember:${ticket.uid}`).setLabel('Adicionar Membro').setEmoji('➕').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:removemember:${ticket.uid}`).setLabel('Remover Membro').setEmoji('❌').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:presetmod:${ticket.uid}`).setLabel('Preset de Moderação').setEmoji('🧩').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket:presetresult:${ticket.uid}`).setLabel('Preset de Resultados').setEmoji('⚖️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:move:${ticket.uid}`).setLabel('Mover Ticket').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:rename:${ticket.uid}`).setLabel('Trocar Nome do Canal').setEmoji('📝').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:note:${ticket.uid}`).setLabel('Observação Interna').setEmoji('🗒️').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket:createcall:${ticket.uid}`).setLabel('Criar Call de Atendimento').setEmoji('🎙️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:claim:${ticket.uid}`).setLabel('Assumir Atendimento').setEmoji('😉').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:greet:${ticket.uid}`).setLabel('Saudar Atendimento').setEmoji('👋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:close:${ticket.uid}`).setLabel('Finalizar Ticket').setEmoji('✅').setStyle(ButtonStyle.Success)
    )
  ];

  return [
    { embeds: [main] },
    { embeds: [userEmbed], components: [userRow] },
    { embeds: [staffEmbed], components: staffRows }
  ];
}

module.exports = { panelMessage, ticketCreatedEphemeral, ticketOpeningMessages };
