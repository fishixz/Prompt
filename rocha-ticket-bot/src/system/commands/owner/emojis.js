const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { colorInt, truncate } = require('../../../utils/discord');

async function execute(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const emojis = [...interaction.guild.emojis.cache.values()].sort((a, b) => a.name.localeCompare(b.name));
  const text = emojis.map((emoji, index) => `${index + 1}. ${emoji} **${emoji.name}** • \`${emoji.id}\` • ${emoji.animated ? 'animado' : 'estático'}`).join('\n') || '_Nenhum emoji personalizado._';

  const chunks = [];
  let current = '';
  for (const line of text.split('\n')) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > 3900) {
      chunks.push(current);
      current = line;
    } else current = next;
  }
  if (current) chunks.push(current);

  const embeds = chunks.slice(0, 10).map((chunk, index) => new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle(index === 0 ? '👑 Emojis do servidor' : `👑 Emojis • Continuação ${index + 1}`)
    .setDescription(truncate(chunk, 4096))
    .setFooter({ text: `Total: ${emojis.length} emoji(s)` }));
  return interaction.editReply({ embeds });
}

module.exports = { id: 'dono.emojis', execute };
