const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { colorInt, truncate } = require('../../../utils/discord');

async function execute(interaction) {
  const query = interaction.options.getString('nome', true).trim().toLowerCase();
  const config = await getGuildConfig(interaction.guildId);
  const matches = [...interaction.guild.emojis.cache.values()]
    .filter(emoji => emoji.name?.toLowerCase().includes(query))
    .slice(0, 50);

  if (!matches.length) return interaction.editReply(`🔎 Nenhum emoji encontrado contendo **${query}**.`);

  const text = matches.map((emoji, index) => `${index + 1}. ${emoji} **${emoji.name}** • \`${emoji.id}\` • ${emoji.animated ? 'animado' : 'estático'}`).join('\n');
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle(`🔎 Emojis encontrados • ${matches.length}`)
    .setDescription(truncate(text, 4096))
    .setFooter({ text: 'Mostrando no máximo 50 resultados.' });
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { id: 'admin.emoji-buscar', execute };
