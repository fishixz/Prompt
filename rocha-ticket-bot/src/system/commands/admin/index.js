const cargoAdicionar = require('./cargoAdicionar');
const cargoRemover = require('./cargoRemover');
const limpar = require('./limpar');
const canalTrancar = require('./canalTrancar');
const canalDestrancar = require('./canalDestrancar');
const cargos = require('./cargos');
const embed = require('./embed');
const emojiBuscar = require('./emojiBuscar');

const handlers = new Map([
  [cargoAdicionar.id, cargoAdicionar.execute],
  [cargoRemover.id, cargoRemover.execute],
  [limpar.id, limpar.execute],
  [canalTrancar.id, canalTrancar.execute],
  [canalDestrancar.id, canalDestrancar.execute],
  [cargos.id, cargos.execute],
  [embed.id, embed.execute],
  [emojiBuscar.id, emojiBuscar.execute]
]);

function commandIdForSubcommand(subcommand) {
  return `admin.${subcommand}`;
}

async function executeAdmin(interaction, subcommand) {
  const commandId = commandIdForSubcommand(subcommand);
  const handler = handlers.get(commandId);
  if (!handler) throw new Error(`Subcomando administrativo não implementado: ${subcommand}`);
  return handler(interaction);
}

module.exports = { handlers, commandIdForSubcommand, executeAdmin };
