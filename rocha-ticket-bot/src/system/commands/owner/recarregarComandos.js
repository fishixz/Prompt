const { registerGuildCommands } = require('../../../commands/registerCommands');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  await registerGuildCommands(interaction.guild);
  await sendSystemAudit(interaction.guild, {
    action: 'Comandos recarregados',
    actor: interaction.user,
    details: 'Os slash commands do RochaSystem foram registrados novamente neste servidor.'
  });
  return interaction.editReply('✅ Os comandos do RochaSystem foram registrados novamente neste servidor.');
}

module.exports = { id: 'dono.recarregar-comandos', execute };
