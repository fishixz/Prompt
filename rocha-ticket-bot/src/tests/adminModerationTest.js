const assert = require('node:assert/strict');
const { commandData } = require('../commands/registerCommands');
const { COMMAND_CATALOG } = require('../system/commandCatalog');
const { handlers: adminHandlers } = require('../system/commands/admin');
const { handlers: moderationHandlers } = require('../system/commands/moderation');
const { normalizeState } = require('../database/store');

const EXPECTED_ADMIN = [
  'cargo-adicionar',
  'cargo-remover',
  'limpar',
  'canal-trancar',
  'canal-destrancar',
  'cargos',
  'embed',
  'emoji-buscar'
];

const EXPECTED_MODERATION = [
  'banir',
  'expulsar',
  'silenciar',
  'dessilenciar',
  'advertir',
  'advertencias',
  'limpar-advertencias',
  'remover-advertencia'
];

function subcommandNames(commandName) {
  const command = commandData.find(item => item.name === commandName);
  assert.ok(command, `/${commandName} não foi registrado`);
  return (command.options || []).map(option => option.name);
}

function run() {
  assert.deepEqual(subcommandNames('admin'), EXPECTED_ADMIN, 'subcomandos /admin divergentes');
  assert.deepEqual(subcommandNames('moderacao'), EXPECTED_MODERATION, 'subcomandos /moderacao divergentes');

  for (const sub of EXPECTED_ADMIN) {
    const id = `admin.${sub}`;
    assert.ok(COMMAND_CATALOG.some(command => command.id === id), `${id} não está no catálogo`);
    assert.equal(typeof adminHandlers.get(id), 'function', `${id} não possui handler`);
  }

  for (const sub of EXPECTED_MODERATION) {
    const id = `moderacao.${sub}`;
    assert.ok(COMMAND_CATALOG.some(command => command.id === id), `${id} não está no catálogo`);
    assert.equal(typeof moderationHandlers.get(id), 'function', `${id} não possui handler`);
  }

  const adminCatalog = COMMAND_CATALOG.filter(command => command.category === 'administracao');
  const moderationCatalog = COMMAND_CATALOG.filter(command => command.category === 'moderacao');
  assert.equal(adminCatalog.length, EXPECTED_ADMIN.length, 'existem comandos de administração sem rota/teste');
  assert.equal(moderationCatalog.length, EXPECTED_MODERATION.length, 'existem comandos de moderação sem rota/teste');

  const db = normalizeState({});
  assert.equal(db.version, 3, 'banco não migrou para schema v3');
  assert.deepEqual(db.moderationWarnings, {}, 'armazenamento de advertências não foi inicializado');
  assert.deepEqual(db.levels, {}, 'armazenamento de níveis não foi inicializado');

  const allTopLevel = commandData.map(command => command.name);
  assert.equal(new Set(allTopLevel).size, allTopLevel.length, 'slash command de topo duplicado');

  console.log('✅ RochaSystem admin/moderation self-test concluído sem erros.');
}

run();
