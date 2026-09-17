const assert = require('node:assert/strict');
const { defaultGuildConfig } = require('../config/defaultConfig');
const { configHome } = require('../panels/configPanel');
const {
  appendSystemEntry,
  systemHomePanel,
  tierPanel,
  commandAccessPanel,
  profilePanel
} = require('../panels/systemConfigPanel');
const {
  ensureSystemConfig,
  accessibleCommands,
  DEFAULT_BIO,
  TIER_ORDER
} = require('../services/accessControlService');
const { COMMAND_CATALOG, COMMAND_CATEGORIES } = require('../system/commandCatalog');
const { duplicatedCustomIds } = require('../services/diagnosticService');

function raw(component) {
  return typeof component?.toJSON === 'function' ? component.toJSON() : component;
}

function validatePayload(name, payload) {
  assert.ok(payload, `${name}: payload ausente`);
  assert.ok((payload.components || []).length <= 5, `${name}: mais de 5 ActionRows`);
  assert.deepEqual(duplicatedCustomIds(payload), [], `${name}: custom_id duplicado`);
  for (const row of payload.components || []) {
    const json = raw(row);
    assert.ok((json.components || []).length <= 5, `${name}: mais de 5 componentes por ActionRow`);
    for (const component of json.components || []) {
      if (component.custom_id) assert.ok(component.custom_id.length <= 100, `${name}: custom_id maior que 100`);
      if (component.options) assert.ok(component.options.length <= 25, `${name}: select com mais de 25 opções`);
    }
  }
}

function fakeMember(roleIds = []) {
  return { roles: { cache: new Map(roleIds.map(id => [id, { id }])) } };
}

function run() {
  const config = defaultGuildConfig('123');
  const system = ensureSystemConfig(config);

  assert.equal(system.identity.name, 'RochaSystem');
  assert.equal(system.identity.bio, DEFAULT_BIO);
  assert.equal(system.identity.bio, 'Sistema Oficial de Bots do RochaSystem.\n\nDeveloped with ♥️ by raposomodz');
  assert.deepEqual(Object.keys(system.access), TIER_ORDER);

  const commandIds = COMMAND_CATALOG.map(command => command.id);
  assert.equal(new Set(commandIds).size, commandIds.length, 'IDs de comandos duplicados no catálogo');
  for (const command of COMMAND_CATALOG) {
    assert.ok(COMMAND_CATEGORIES[command.category], `Categoria inexistente em ${command.id}`);
  }

  const home = appendSystemEntry(configHome(config, { ok: true, missing: [], warnings: [] }));
  validatePayload('config + RochaSystem', home);
  validatePayload('system home', systemHomePanel(config));
  validatePayload('profile', profilePanel(config));
  for (const tier of TIER_ORDER) {
    validatePayload(`tier ${tier}`, tierPanel(config, tier));
    validatePayload(`commands ${tier}`, commandAccessPanel(config, tier, 0));
  }

  const guild = { ownerId: 'owner' };
  assert.equal(accessibleCommands(config, fakeMember(), guild, 'unknown').length, 0, 'usuário sem cargo recebeu comandos');

  system.access.cidadao.roleIds = ['cidadao-role'];
  const citizenCommands = accessibleCommands(config, fakeMember(['cidadao-role']), guild, 'citizen');
  assert.ok(citizenCommands.some(command => command.id === 'ajuda'), 'Cidadão não recebeu utilidades padrão');
  assert.ok(!citizenCommands.some(command => command.ownerOnly), 'Cidadão recebeu comando exclusivo do Dono');

  system.access.dono.roleIds = ['owner-role'];
  const ownerCommands = accessibleCommands(config, fakeMember(['owner-role']), guild, 'staff-owner');
  assert.equal(ownerCommands.length, COMMAND_CATALOG.length, 'Dono não recebeu catálogo completo');

  const guildOwnerCommands = accessibleCommands(config, fakeMember(), guild, 'owner');
  assert.equal(guildOwnerCommands.length, COMMAND_CATALOG.length, 'Dono real do servidor não recebeu catálogo completo');

  console.log('✅ RochaSystem access self-test concluído sem erros.');
}

run();
