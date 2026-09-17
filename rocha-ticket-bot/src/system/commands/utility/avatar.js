const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { colorInt } = require('../../../utils/discord');

async function execute(interaction) {
  const user = interaction.options.getUser('usuario') || interaction.user;
  const config = await getGuildConfig(interaction.guildId);
  const url = user.displayAvatarURL({ size: 1024, extension: 'png', forceStatic: false });
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle(`🖼️ Avatar • ${user.tag}`)
    .setImage(url)
    .setDescription(`[Abrir imagem em tamanho original](${url})`);
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { id: 'utilidade.avatar', execute };
