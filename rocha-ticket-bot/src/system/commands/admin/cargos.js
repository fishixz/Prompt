const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { colorInt, truncate } = require('../../../utils/discord');

async function execute(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const roles = [...interaction.guild.roles.cache.values()]
    .filter(role => role.id !== interaction.guild.id)
    .sort((a, b) => b.position - a.position);

  const lines = roles.map((role, index) => `${index + 1}. ${role} • \`${role.id}\` • ${role.members.size} membro(s)`);
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if ((current + '\n' + line).length > 3900) {
      chunks.push(current);
      current = line;
    } else {
      current += `${current ? '\n' : ''}${line}`;
    }
  }
  if (current) chunks.push(current);
  if (!chunks.length) chunks.push('_Nenhum cargo além de @everyone._');

  const embeds = chunks.slice(0, 10).map((text, index) => new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle(index === 0 ? `📚 Cargos de ${interaction.guild.name}` : `📚 Cargos • Continuação ${index + 1}`)
    .setDescription(truncate(text, 4096))
    .setFooter({ text: `Total: ${roles.length} cargo(s)` }));

  return interaction.editReply({ embeds });
}

module.exports = { id: 'admin.cargos', execute };
