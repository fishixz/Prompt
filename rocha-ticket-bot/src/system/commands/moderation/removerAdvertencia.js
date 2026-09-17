const { assertCanModerate } = require('../../../services/moderationGuard');
const { removeWarning } = require('../../../services/warningService');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const member = interaction.options.getMember('usuario');
  const warningId = interaction.options.getString('id', true).trim();
  const reason = interaction.options.getString('motivo') || 'Advertência removida pela equipe.';
  assertCanModerate(interaction, member);

  const removed = await removeWarning(interaction.guildId, member.id, warningId);
  if (!removed) return interaction.editReply(`⚠️ Não encontrei a advertência \`${warningId}\` para ${member}.`);

  await sendSystemAudit(interaction.guild, {
    action: 'Advertência removida',
    actor: interaction.user,
    target: member.user,
    reason,
    details: `ID removido: \`${warningId}\``,
    color: 0x57f287
  });
  return interaction.editReply(`✅ Advertência \`${warningId}\` removida de ${member}.`);
}

module.exports = { id: 'moderacao.remover-advertencia', execute };
