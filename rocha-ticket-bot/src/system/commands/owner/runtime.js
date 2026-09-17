const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { colorInt } = require('../../../utils/discord');

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatUptime(seconds) {
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

async function execute(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const memory = process.memoryUsage();
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle('👑 RochaSystem • Runtime')
    .addFields(
      { name: 'Node.js', value: `\`${process.version}\``, inline: true },
      { name: 'PID', value: `\`${process.pid}\``, inline: true },
      { name: 'Plataforma', value: `\`${process.platform} ${process.arch}\``, inline: true },
      { name: 'Uptime do processo', value: formatUptime(process.uptime()), inline: true },
      { name: 'Ping WebSocket', value: `\`${interaction.client.ws.ping} ms\``, inline: true },
      { name: 'Servidores', value: `\`${interaction.client.guilds.cache.size}\``, inline: true },
      { name: 'RSS', value: formatBytes(memory.rss), inline: true },
      { name: 'Heap usado', value: formatBytes(memory.heapUsed), inline: true },
      { name: 'Heap total', value: formatBytes(memory.heapTotal), inline: true }
    )
    .setTimestamp();
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { id: 'dono.runtime', execute };
