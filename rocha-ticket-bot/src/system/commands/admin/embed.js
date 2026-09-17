const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { colorInt } = require('../../../utils/discord');
const { sendSystemAudit } = require('../../../services/systemAuditService');

function parseColor(value, fallback) {
  if (!value) return fallback;
  const cleaned = String(value).trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) throw new Error('Cor inválida. Use hexadecimal, por exemplo `#F5A300`.');
  return Number.parseInt(cleaned, 16);
}

async function execute(interaction) {
  const title = interaction.options.getString('titulo');
  const description = interaction.options.getString('descricao', true);
  const color = interaction.options.getString('cor');
  const channel = interaction.options.getChannel('canal') || interaction.channel;

  if (!channel?.isTextBased()) throw new Error('Escolha um canal de texto válido.');
  const me = interaction.guild.members.me;
  const perms = channel.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.SendMessages) || !perms?.has(PermissionFlagsBits.EmbedLinks)) {
    throw new Error('Preciso das permissões **Enviar Mensagens** e **Inserir Links/Embeds** nesse canal.');
  }

  const config = await getGuildConfig(interaction.guildId);
  const embed = new EmbedBuilder()
    .setColor(parseColor(color, colorInt(config.branding?.color || '#F5A300')))
    .setDescription(description)
    .setTimestamp();
  if (title) embed.setTitle(title);
  if (config.branding?.footer) embed.setFooter({ text: config.branding.footer });

  const message = await channel.send({ embeds: [embed] });
  await sendSystemAudit(interaction.guild, {
    action: 'Embed enviada',
    actor: interaction.user,
    details: `Canal: ${channel} • Mensagem: \`${message.id}\``
  });
  return interaction.editReply(`✅ Embed enviada em ${channel}.`);
}

module.exports = { id: 'admin.embed', execute };
