const { PermissionFlagsBits } = require('discord.js');
const { assertBotPermission, assertCanModerate, assertRoleManageable } = require('../../../services/moderationGuard');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const member = interaction.options.getMember('usuario');
  const role = interaction.options.getRole('cargo', true);
  const reason = interaction.options.getString('motivo') || 'Sem motivo informado.';

  assertBotPermission(interaction, PermissionFlagsBits.ManageRoles, 'Gerenciar Cargos');
  assertCanModerate(interaction, member);
  assertRoleManageable(interaction, role);

  if (!member.roles.cache.has(role.id)) {
    return interaction.editReply(`⚠️ ${member} não possui o cargo ${role}.`);
  }

  await member.roles.remove(role, `RochaSystem • ${interaction.user.tag}: ${reason}`);
  await sendSystemAudit(interaction.guild, {
    action: 'Cargo removido',
    actor: interaction.user,
    target: member.user,
    reason,
    details: `Cargo: ${role} (\`${role.id}\`)`
  });
  return interaction.editReply(`✅ ${role} foi removido de ${member}.`);
}

module.exports = { id: 'admin.cargo-remover', execute };
