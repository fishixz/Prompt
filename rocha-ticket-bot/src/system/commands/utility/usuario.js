const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { colorInt } = require('../../../utils/discord');

async function execute(interaction) {
  const user = interaction.options.getUser('usuario') || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const config = await getGuildConfig(interaction.guildId);
  const created = Math.floor(user.createdTimestamp / 1000);
  const joined = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
  const roles = member
    ? member.roles.cache.filter(role => role.id !== interaction.guild.id).sort((a, b) => b.position - a.position).first(15).map(role => `${role}`).join(', ') || '_nenhum_'
    : '_usuário não está no servidor_';

  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle(`👤 Usuário • ${user.tag}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'ID', value: `\`${user.id}\``, inline: true },
      { name: 'Bot', value: user.bot ? 'Sim' : 'Não', inline: true },
      { name: 'Conta criada', value: `<t:${created}:F>\n<t:${created}:R>`, inline: false },
      { name: 'Entrou no servidor', value: joined ? `<t:${joined}:F>\n<t:${joined}:R>` : '_não está no servidor_', inline: false },
      { name: 'Cargos', value: roles.slice(0, 1024), inline: false }
    )
    .setTimestamp();
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { id: 'utilidade.usuario', execute };
