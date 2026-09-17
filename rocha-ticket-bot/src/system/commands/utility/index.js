const ping = require('./ping');
const avatar = require('./avatar');
const usuario = require('./usuario');
const servidor = require('./servidor');
const convite = require('./convite');

const handlers = new Map([
  [ping.id, ping.execute],
  [avatar.id, avatar.execute],
  [usuario.id, usuario.execute],
  [servidor.id, servidor.execute],
  [convite.id, convite.execute]
]);

function commandIdForSubcommand(subcommand) {
  return `utilidade.${subcommand}`;
}

async function executeUtility(interaction, subcommand) {
  const commandId = commandIdForSubcommand(subcommand);
  const handler = handlers.get(commandId);
  if (!handler) throw new Error(`Subcomando de utilidade não implementado: ${subcommand}`);
  return handler(interaction);
}

module.exports = { handlers, commandIdForSubcommand, executeUtility };
