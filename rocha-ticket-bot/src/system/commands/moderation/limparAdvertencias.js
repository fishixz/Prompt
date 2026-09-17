const { assertCanModerate } = require('../../../services/moderationGuard');
const { clearWarnings } = require('../../../services/warningService');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const member = interaction.options.getMember('usuario');
  const reason = interaction.options.getString('motivo') || 'Histórico de advertências limpo pela equipe.';
  assertCanModerate(interaction, member);

  const count = await clearWarnings(interaction.guildId, member.id);
  await sendSystemAudit(interaction.guild, {
    action: 'Advertências limpas',
    actor: interaction.user,
    target: member.user,
    reason,
    details: `${count} advertência(s) removida(s).`,
    color: 0x57f287
  });
  return interaction.editReply(`✅ **${count}** advertência(s) de ${member} foram removidas.`);
}

module.exports = { id: 'moderacao.limpar-advertencias', execute };
