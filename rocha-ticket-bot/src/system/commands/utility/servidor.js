const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { colorInt } = require('../../../utils/discord');

async function execute(interaction) {
  const guild = interaction.guild;
  const config = await getGuildConfig(guild.id);
  const owner = await guild.fetchOwner().catch(() => null);
  const created = Math.floor(guild.createdTimestamp / 1000);
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle(`🏠 ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: 'ID', value: `\`${guild.id}\``, inline: true },
      { name: 'Membros', value: `\`${guild.memberCount}\``, inline: true },
      { name: 'Dono', value: owner ? `${owner}` : `<@${guild.ownerId}>`, inline: true },
      { name: 'Cargos', value: `\`${guild.roles.cache.size}\``, inline: true },
      { name: 'Canais', value: `\`${guild.channels.cache.size}\``, inline: true },
      { name: 'Emojis', value: `\`${guild.emojis.cache.size}\``, inline: true },
      { name: 'Criado em', value: `<t:${created}:F>\n<t:${created}:R>`, inline: false }
    )
    .setTimestamp();
  if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }));
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { id: 'utilidade.servidor', execute };
