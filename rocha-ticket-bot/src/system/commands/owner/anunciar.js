const { PermissionFlagsBits } = require('discord.js');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const channel = interaction.options.getChannel('canal', true);
  const message = interaction.options.getString('mensagem', true);
  if (!channel?.isTextBased()) throw new Error('Escolha um canal de texto válido.');

  const permissions = channel.permissionsFor(interaction.guild.members.me);
  if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    throw new Error('O RochaSystem não possui permissão para enviar mensagens nesse canal.');
  }

  const sent = await channel.send({ content: message });
  await sendSystemAudit(interaction.guild, {
    action: 'Anúncio enviado',
    actor: interaction.user,
    details: `Canal: ${channel} • Mensagem: \`${sent.id}\``
  });
  return interaction.editReply(`✅ Anúncio enviado em ${channel}.`);
}

module.exports = { id: 'dono.anunciar', execute };
