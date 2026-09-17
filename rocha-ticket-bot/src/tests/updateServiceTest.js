const assert = require('node:assert/strict');
const {
  parseSemver,
  compareSemver,
  normalizeRepoFromRemote,
  readLocalVersion,
  checkForUpdate,
  UPDATE_REPO,
  UPDATE_BRANCH
} = require('../services/updateService');

async function run() {
  assert.deepEqual(parseSemver('v2.0.0-beta.6').prerelease, ['beta', '6']);
  assert.equal(compareSemver('2.0.0-beta.6', '2.0.0-beta.5'), 1);
  assert.equal(compareSemver('2.0.0', '2.0.0-beta.99'), 1);
  assert.equal(compareSemver('2.0.0-beta.5', '2.0.0-beta.6'), -1);
  assert.equal(compareSemver('2.1.0', '2.0.99'), 1);
  assert.equal(compareSemver('2.0.0-beta.6', '2.0.0-beta.6'), 0);

  assert.equal(normalizeRepoFromRemote('https://github.com/fishixz/RochaSystem.git'), 'fishixz/RochaSystem');
  assert.equal(normalizeRepoFromRemote('git@github.com:fishixz/RochaSystem.git'), 'fishixz/RochaSystem');
  assert.equal(normalizeRepoFromRemote('ssh://git@github.com/fishixz/RochaSystem.git'), 'fishixz/RochaSystem');

  const local = await readLocalVersion();
  assert.equal(local, '2.0.0-beta.6');
  assert.equal(UPDATE_REPO, 'fishixz/RochaSystem');
  assert.equal(UPDATE_BRANCH, 'main');

  const newer = await checkForUpdate({
    fetchImpl: async () => ({ ok: true, text: async () => '2.0.0-beta.7\n' })
  });
  assert.equal(newer.available, true);
  assert.equal(newer.remoteVersion, '2.0.0-beta.7');

  const older = await checkForUpdate({
    fetchImpl: async () => ({ ok: true, text: async () => '1.9.9\n' })
  });
  assert.equal(older.available, false);
  assert.equal(older.remoteIsOlder, true);

  console.log('✅ RochaSystem update service self-test concluído sem erros.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
