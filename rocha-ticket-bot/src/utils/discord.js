const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  parseEmoji
} = require('discord.js');

function colorInt(hex = '#F5A300') {
  const clean = String(hex).replace('#', '');
  const parsed = Number.parseInt(clean, 16);
  return Number.isFinite(parsed) ? parsed : 0xF5A300;
}

function truncate(text, max = 1024) {
  const s = String(text ?? '');
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}

function componentEmoji(input) {
  if (!input) return null;
  try {
    const parsed = parseEmoji(String(input));
    if (parsed?.id) return { id: parsed.id, name: parsed.name, animated: parsed.animated };
  } catch {}
  const raw = String(input).trim();
  if (!raw || /^:[a-zA-Z0-9_]+:$/.test(raw)) return null;
  return { name: raw };
}

function simpleEmbed(config, title, description, color = null) {
  const embed = new EmbedBuilder()
    .setColor(color ?? colorInt(config?.branding?.color))
    .setTitle(truncate(title, 256))
    .setDescription(truncate(description, 4096))
    .setTimestamp();
  if (config?.branding?.footer) embed.setFooter({ text: truncate(config.branding.footer, 2048) });
  return embed;
}

function navButtons(backId, homeId = 'config:home') {
  const resolvedBackId = backId || homeId;
  const row = new ActionRowBuilder();

  // O Discord não permite dois componentes com o mesmo custom_id na mesma mensagem.
  // Várias telas chamavam navButtons('config:home'), o que criava dois botões
  // com custom_id "config:home" e quebrava qualquer atualização do painel.
  if (resolvedBackId === homeId) {
    return row.addComponents(
      new ButtonBuilder()
        .setCustomId(homeId)
        .setLabel('Início')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  return row.addComponents(
    new ButtonBuilder()
      .setCustomId(resolvedBackId)
      .setLabel('Voltar')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(homeId)
      .setLabel('Início')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary)
  );
}

function optionWithEmoji(option) {
  const out = {
    label: truncate(option.label, 100),
    value: String(option.value),
    description: option.description ? truncate(option.description, 100) : undefined
  };
  const emoji = componentEmoji(option.emoji);
  if (emoji) out.emoji = emoji;
  return out;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function stringSelect(customId, placeholder, options, min = 1, max = 1) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(truncate(placeholder, 150))
    .setMinValues(min)
    .setMaxValues(Math.min(max, options.length))
    .addOptions(options.map(optionWithEmoji));
}

module.exports = {
  colorInt,
  truncate,
  componentEmoji,
  simpleEmbed,
  navButtons,
  chunk,
  stringSelect
};
