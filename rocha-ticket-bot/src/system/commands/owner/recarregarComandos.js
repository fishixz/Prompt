const { registerGuildSystemCommands } = require('../../../commands/allCommands');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  await registerGuildSystemCommands(interaction.guild);
  await sendSystemAudit(interaction.guild, {
    action: 'Comandos recarregados',
    actor: interaction.user,
    details: 'Todos os slash commands do RochaSystem foram registrados novamente neste servidor.'
  });
  return interaction.editReply('✅ Todos os comandos do RochaSystem foram registrados novamente neste servidor.');
}

module.exports = { id: 'dono.recarregar-comandos', execute };
