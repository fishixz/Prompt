const assert = require('node:assert/strict');
const { extraCommandData } = require('../commands/extraCommands');
const { COMMAND_CATALOG, commandById } = require('../system/commandCatalog');
const { defaultSystemConfig, DEFAULT_BIO } = require('../services/accessControlService');
const { blockedWordInText, normalizeWord } = require('../services/automodService');
const { levelFromXp, xpForLevel } = require('../services/levelService');
const { emojify } = require('../system/commands/fun');

const names = extraCommandData.map(command => command.name);
assert.equal(new Set(names).size, names.length, 'Comandos extras possuem nomes duplicados.');
assert.deepEqual(new Set(names), new Set(['automod', 'pesquisa', 'diversao', 'jogo', 'nivel', 'backup']));

for (const id of [
  'automod.ver', 'automod.adicionar-palavra',
  'pesquisa.github', 'diversao.oito-bola', 'jogo.ppt',
  'nivel.perfil', 'nivel.configurar', 'backup.criar', 'backup.restaurar'
]) {
  assert.ok(commandById(id), `Comando ${id} ausente no catálogo.`);
}

const config = defaultSystemConfig();
assert.equal(config.identity.name, 'RochaSystem');
assert.equal(DEFAULT_BIO, 'Sistema Oficial de Bots do RochaSystem.\n\nDeveloped with ♥️ by raposomodz');
assert.equal(config.automod.enabled, false);
assert.equal(config.levels.enabled, true);

assert.equal(normalizeWord('  OlÁ  '), 'ola');
assert.equal(blockedWordInText('isso é uma PALAVRA ruim', ['palavra']), 'palavra');
assert.equal(blockedWordInText('palavrada não deve casar', ['palavra']), null);

assert.deepEqual(levelFromXp(0), { level: 0, currentXp: 0, requiredXp: 100 });
assert.equal(levelFromXp(xpForLevel(0)).level, 1);
assert.ok(emojify('abc').includes('🇦'));

assert.ok(COMMAND_CATALOG.length >= 50, 'Catálogo multifunções ficou menor do que o esperado.');
console.log(`✅ RochaSystem multifunction test: ${COMMAND_CATALOG.length} comandos catalogados; ${names.length} grupos extras válidos.`);
