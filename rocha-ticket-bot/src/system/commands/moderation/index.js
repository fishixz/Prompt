const banir = require('./banir');
const expulsar = require('./expulsar');
const silenciar = require('./silenciar');
const dessilenciar = require('./dessilenciar');
const advertir = require('./advertir');
const advertencias = require('./advertencias');
const limparAdvertencias = require('./limparAdvertencias');
const removerAdvertencia = require('./removerAdvertencia');

const handlers = new Map([
  [banir.id, banir.execute],
  [expulsar.id, expulsar.execute],
  [silenciar.id, silenciar.execute],
  [dessilenciar.id, dessilenciar.execute],
  [advertir.id, advertir.execute],
  [advertencias.id, advertencias.execute],
  [limparAdvertencias.id, limparAdvertencias.execute],
  [removerAdvertencia.id, removerAdvertencia.execute]
]);

function commandIdForSubcommand(subcommand) {
  return `moderacao.${subcommand}`;
}

async function executeModeration(interaction, subcommand) {
  const commandId = commandIdForSubcommand(subcommand);
  const handler = handlers.get(commandId);
  if (!handler) throw new Error(`Subcomando de moderação não implementado: ${subcommand}`);
  return handler(interaction);
}

module.exports = { handlers, commandIdForSubcommand, executeModeration };
