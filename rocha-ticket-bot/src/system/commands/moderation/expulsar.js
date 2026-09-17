const { PermissionFlagsBits } = require('discord.js');
const { assertBotPermission, assertCanModerate } = require('../../../services/moderationGuard');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const member = interaction.options.getMember('usuario');
  const reason = interaction.options.getString('motivo') || 'Sem motivo informado.';

  assertBotPermission(interaction, PermissionFlagsBits.KickMembers, 'Expulsar Membros');
  assertCanModerate(interaction, member);
  if (!member.kickable) throw new Error('Não consigo expulsar esse membro com a hierarquia/permissões atuais.');

  await member.user.send(`👢 Você foi expulso de **${interaction.guild.name}**.\n**Motivo:** ${reason}`).catch(() => null);
  await member.kick(`RochaSystem • ${interaction.user.tag}: ${reason}`);

  await sendSystemAudit(interaction.guild, {
    action: 'Usuário expulso',
    actor: interaction.user,
    target: member.user,
    reason,
    color: 0xfee75c
  });
  return interaction.editReply(`👢 **${member.user.tag}** foi expulso. **Motivo:** ${reason}`);
}

module.exports = { id: 'moderacao.expulsar', execute };
