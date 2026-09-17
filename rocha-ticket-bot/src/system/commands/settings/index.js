const auditoria = require('./auditoria');
const cor = require('./cor');
const rodape = require('./rodape');
const ver = require('./ver');

const handlers = new Map([
  [auditoria.id, auditoria.execute],
  [cor.id, cor.execute],
  [rodape.id, rodape.execute],
  [ver.id, ver.execute]
]);

function commandIdForSubcommand(subcommand) {
  return `configuracao.${subcommand}`;
}

async function executeSettings(interaction, subcommand) {
  const commandId = commandIdForSubcommand(subcommand);
  const handler = handlers.get(commandId);
  if (!handler) throw new Error(`Subcomando de configuração não implementado: ${subcommand}`);
  return handler(interaction);
}

module.exports = { handlers, commandIdForSubcommand, executeSettings };
