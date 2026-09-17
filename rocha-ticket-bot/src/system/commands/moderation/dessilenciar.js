const { PermissionFlagsBits } = require('discord.js');
const { assertBotPermission, assertCanModerate } = require('../../../services/moderationGuard');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const member = interaction.options.getMember('usuario');
  const reason = interaction.options.getString('motivo') || 'Silenciamento removido pela equipe.';

  assertBotPermission(interaction, PermissionFlagsBits.ModerateMembers, 'Moderar Membros');
  assertCanModerate(interaction, member);
  if (!member.moderatable) throw new Error('Não consigo alterar o silenciamento desse membro com a hierarquia/permissões atuais.');

  await member.timeout(null, `RochaSystem • ${interaction.user.tag}: ${reason}`);
  await member.user.send(`🔊 Seu silenciamento em **${interaction.guild.name}** foi removido.\n**Motivo:** ${reason}`).catch(() => null);

  await sendSystemAudit(interaction.guild, {
    action: 'Silenciamento removido',
    actor: interaction.user,
    target: member.user,
    reason,
    color: 0x57f287
  });
  return interaction.editReply(`🔊 O silenciamento de ${member} foi removido.`);
}

module.exports = { id: 'moderacao.dessilenciar', execute };
