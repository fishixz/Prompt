const assert = require('node:assert/strict');
const { commandData } = require('../commands/registerCommands');
const { COMMAND_CATALOG, commandById } = require('../system/commandCatalog');
const owner = require('../system/commands/owner');
const settings = require('../system/commands/settings');
const utility = require('../system/commands/utility');

function command(name) {
  return commandData.find(item => item.name === name);
}

function subcommands(name) {
  return new Set((command(name)?.options || []).filter(option => option.type === 1).map(option => option.name));
}

function assertGroup(groupName, expected, dispatcher, prefix) {
  const registered = subcommands(groupName);
  assert.ok(command(groupName), `/${groupName} não foi registrado`);
  for (const sub of expected) {
    assert.ok(registered.has(sub), `/${groupName} ${sub} não foi registrado`);
    const id = `${prefix}.${sub}`;
    assert.ok(commandById(id), `${id} não está no catálogo`);
    assert.ok(dispatcher.handlers.has(id), `${id} não possui executor`);
  }
}

assertGroup(
  'dono',
  ['servidores', 'recarregar-comandos', 'emojis', 'runtime', 'anunciar'],
  owner,
  'dono'
);

for (const id of ['dono.servidores', 'dono.recarregar-comandos', 'dono.emojis', 'dono.runtime', 'dono.anunciar']) {
  assert.equal(commandById(id).ownerOnly, true, `${id} precisa ser exclusivo do Dono`);
}

assertGroup(
  'configuracao',
  ['ver', 'auditoria', 'cor', 'rodape'],
  settings,
  'configuracao'
);

assertGroup(
  'utilidade',
  ['ping', 'avatar', 'usuario', 'servidor', 'convite'],
  utility,
  'utilidade'
);

const duplicateIds = COMMAND_CATALOG
  .map(item => item.id)
  .filter((id, index, array) => array.indexOf(id) !== index);
assert.deepEqual(duplicateIds, [], 'Há IDs duplicados no catálogo de comandos');

console.log('✅ RochaSystem owner/settings/utility self-test concluído sem erros.');
