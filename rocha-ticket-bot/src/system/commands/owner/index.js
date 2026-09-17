const servidores = require('./servidores');
const recarregarComandos = require('./recarregarComandos');
const emojis = require('./emojis');
const runtime = require('./runtime');
const anunciar = require('./anunciar');

const handlers = new Map([
  [servidores.id, servidores.execute],
  [recarregarComandos.id, recarregarComandos.execute],
  [emojis.id, emojis.execute],
  [runtime.id, runtime.execute],
  [anunciar.id, anunciar.execute]
]);

function commandIdForSubcommand(subcommand) {
  return `dono.${subcommand}`;
}

async function executeOwner(interaction, subcommand) {
  const commandId = commandIdForSubcommand(subcommand);
  const handler = handlers.get(commandId);
  if (!handler) throw new Error(`Subcomando de dono não implementado: ${subcommand}`);
  return handler(interaction);
}

module.exports = { handlers, commandIdForSubcommand, executeOwner };
