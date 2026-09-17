const { PermissionFlagsBits } = require('discord.js');
const { assertBotPermission, assertCanModerate } = require('../../../services/moderationGuard');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const member = interaction.options.getMember('usuario');
  const minutes = interaction.options.getInteger('minutos', true);
  const reason = interaction.options.getString('motivo') || 'Sem motivo informado.';

  assertBotPermission(interaction, PermissionFlagsBits.ModerateMembers, 'Moderar Membros');
  assertCanModerate(interaction, member);
  if (!member.moderatable) throw new Error('Não consigo silenciar esse membro com a hierarquia/permissões atuais.');

  const safeMinutes = Math.max(1, Math.min(40320, minutes));
  await member.timeout(safeMinutes * 60_000, `RochaSystem • ${interaction.user.tag}: ${reason}`);
  await member.user.send(`🔇 Você foi silenciado em **${interaction.guild.name}** por **${safeMinutes} minuto(s)**.\n**Motivo:** ${reason}`).catch(() => null);

  await sendSystemAudit(interaction.guild, {
    action: 'Usuário silenciado',
    actor: interaction.user,
    target: member.user,
    reason,
    details: `Duração: ${safeMinutes} minuto(s).`,
    color: 0x5865f2
  });
  return interaction.editReply(`🔇 ${member} foi silenciado por **${safeMinutes} minuto(s)**.`);
}

module.exports = { id: 'moderacao.silenciar', execute };
