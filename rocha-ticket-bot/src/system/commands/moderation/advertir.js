const { assertCanModerate } = require('../../../services/moderationGuard');
const { addWarning } = require('../../../services/warningService');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const member = interaction.options.getMember('usuario');
  const reason = interaction.options.getString('motivo', true).trim();
  assertCanModerate(interaction, member);

  const warning = await addWarning(interaction.guildId, member.id, interaction.user.id, reason);
  await member.user.send(`⚠️ Você recebeu uma advertência em **${interaction.guild.name}**.\n**Motivo:** ${reason}\n**ID:** \`${warning.id}\``).catch(() => null);

  await sendSystemAudit(interaction.guild, {
    action: 'Advertência aplicada',
    actor: interaction.user,
    target: member.user,
    reason,
    details: `ID da advertência: \`${warning.id}\``,
    color: 0xfee75c
  });
  return interaction.editReply(`⚠️ Advertência \`${warning.id}\` aplicada a ${member}.`);
}

module.exports = { id: 'moderacao.advertir', execute };
