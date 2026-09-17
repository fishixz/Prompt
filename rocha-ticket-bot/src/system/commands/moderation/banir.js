const { PermissionFlagsBits } = require('discord.js');
const { assertBotPermission, assertCanModerate } = require('../../../services/moderationGuard');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const user = interaction.options.getUser('usuario', true);
  const member = interaction.options.getMember('usuario');
  const reason = interaction.options.getString('motivo') || 'Sem motivo informado.';
  const deleteHours = interaction.options.getInteger('apagar_horas') || 0;

  assertBotPermission(interaction, PermissionFlagsBits.BanMembers, 'Banir Membros');
  if (user.id === interaction.user.id) throw new Error('Você não pode banir a si mesmo.');
  if (user.id === interaction.client.user.id) throw new Error('Não posso banir a mim mesmo.');
  if (user.id === interaction.guild.ownerId) throw new Error('O dono do servidor não pode ser banido por este comando.');
  if (member) assertCanModerate(interaction, member);

  await user.send(`🔨 Você foi banido de **${interaction.guild.name}**.\n**Motivo:** ${reason}`).catch(() => null);
  await interaction.guild.members.ban(user.id, {
    deleteMessageSeconds: Math.max(0, Math.min(168, deleteHours)) * 3600,
    reason: `RochaSystem • ${interaction.user.tag}: ${reason}`
  });

  await sendSystemAudit(interaction.guild, {
    action: 'Usuário banido',
    actor: interaction.user,
    target: user,
    reason,
    details: deleteHours ? `Mensagens removidas das últimas ${deleteHours}h.` : 'Mensagens antigas preservadas.',
    color: 0xed4245
  });
  return interaction.editReply(`🔨 ${user} foi banido. **Motivo:** ${reason}`);
}

module.exports = { id: 'moderacao.banir', execute };
