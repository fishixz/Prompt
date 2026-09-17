const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { colorInt, truncate } = require('../../../utils/discord');

async function execute(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const guilds = [...interaction.client.guilds.cache.values()].sort((a, b) => b.memberCount - a.memberCount);
  const lines = guilds.map((guild, index) => `${index + 1}. **${guild.name}** • \`${guild.id}\` • ${guild.memberCount} membro(s)`);
  const text = lines.join('\n') || '_O bot não está em nenhum servidor._';
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle('👑 RochaSystem • Servidores')
    .setDescription(truncate(text, 4096))
    .setFooter({ text: `Total: ${guilds.length} servidor(es)` })
    .setTimestamp();
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { id: 'dono.servidores', execute };
