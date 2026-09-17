const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { listWarnings } = require('../../../services/warningService');
const { colorInt, truncate } = require('../../../utils/discord');

async function execute(interaction) {
  const user = interaction.options.getUser('usuario', true);
  const config = await getGuildConfig(interaction.guildId);
  const warnings = await listWarnings(interaction.guildId, user.id);

  if (!warnings.length) return interaction.editReply(`✅ ${user} não possui advertências registradas no RochaSystem.`);

  const lines = warnings.map((warning, index) => {
    const when = Math.floor(new Date(warning.createdAt).getTime() / 1000);
    return `${index + 1}. **ID:** \`${warning.id}\` • <t:${when}:R>\n**Motivo:** ${warning.reason}\n**Moderador:** <@${warning.moderatorId}>`;
  });

  const chunks = [];
  let current = '';
  for (const line of lines) {
    const next = current ? `${current}\n\n${line}` : line;
    if (next.length > 3900) {
      chunks.push(current);
      current = line;
    } else current = next;
  }
  if (current) chunks.push(current);

  const embeds = chunks.slice(0, 10).map((text, index) => new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle(index === 0 ? `⚠️ Advertências • ${user.tag}` : `⚠️ Advertências • Continuação ${index + 1}`)
    .setDescription(truncate(text, 4096))
    .setFooter({ text: `Total: ${warnings.length} advertência(s)` }));
  return interaction.editReply({ embeds });
}

module.exports = { id: 'moderacao.advertencias', execute };
