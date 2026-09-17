const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const VERSION_FILE = path.join(PROJECT_ROOT, 'version.txt');
const PACKAGE_FILE = path.join(PROJECT_ROOT, 'package.json');
const UPDATE_REPO = process.env.ROCHASYSTEM_UPDATE_REPO || 'fishixz/RochaSystem';
const UPDATE_BRANCH = process.env.ROCHASYSTEM_UPDATE_BRANCH || 'main';
const UPDATE_INTERVAL_MS = 3 * 60 * 60 * 1000;
const UPDATE_INITIAL_DELAY_MS = 60 * 1000;
const UPDATE_EXIT_CODE = 75;

let updateInProgress = false;
let autoUpdateTimer = null;
let initialUpdateTimer = null;
let lastStatus = {
  checkedAt: null,
  currentVersion: null,
  remoteVersion: null,
  available: false,
  updatedAt: null,
  error: null
};

function cleanVersion(value) {
  return String(value || '').trim().replace(/^v/i, '').split('+')[0];
}

function parseSemver(value) {
  const clean = cleanVersion(value);
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) throw new Error(`Versão inválida: ${value}`);
  return {
    raw: clean,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : []
  };
}

function compareIdentifiers(a, b) {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) return Number(a) === Number(b) ? 0 : (Number(a) > Number(b) ? 1 : -1);
  if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
  return a === b ? 0 : (a > b ? 1 : -1);
}

function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  }
  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let i = 0; i < length; i += 1) {
    if (left.prerelease[i] === undefined) return -1;
    if (right.prerelease[i] === undefined) return 1;
    const result = compareIdentifiers(left.prerelease[i], right.prerelease[i]);
    if (result) return result;
  }
  return 0;
}

function normalizeRepoFromRemote(remoteUrl) {
  const value = String(remoteUrl || '').trim().replace(/\.git$/i, '');
  const ssh = value.match(/^git@github\.com:(.+\/.+)$/i);
  if (ssh) return ssh[1];
  const sshProtocol = value.match(/^ssh:\/\/git@github\.com\/(.+\/.+)$/i);
  if (sshProtocol) return sshProtocol[1];
  const https = value.match(/^https?:\/\/github\.com\/(.+\/.+)$/i);
  if (https) return https[1];
  return value;
}

function remoteVersionUrl() {
  return `https://raw.githubusercontent.com/${UPDATE_REPO}/${encodeURIComponent(UPDATE_BRANCH)}/version.txt`;
}

async function readLocalVersion() {
  try {
    const version = cleanVersion(await fs.readFile(VERSION_FILE, 'utf8'));
    parseSemver(version);
    return version;
  } catch {
    const pkg = JSON.parse(await fs.readFile(PACKAGE_FILE, 'utf8'));
    const version = cleanVersion(pkg.version);
    parseSemver(version);
    return version;
  }
}

async function fetchRemoteVersion(fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  timeout.unref?.();
  try {
    const response = await fetchImpl(`${remoteVersionUrl()}?t=${Date.now()}`, {
      signal: controller.signal,
      headers: {
        'user-agent': 'RochaSystem-Updater/1.0',
        'cache-control': 'no-cache'
      }
    });
    if (!response.ok) throw new Error(`GitHub respondeu HTTP ${response.status} ao consultar version.txt.`);
    const version = cleanVersion(await response.text());
    if (version.length > 80) throw new Error('version.txt remoto é inválido ou grande demais.');
    parseSemver(version);
    return version;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkForUpdate({ fetchImpl = fetch } = {}) {
  const currentVersion = await readLocalVersion();
  const remoteVersion = await fetchRemoteVersion(fetchImpl);
  const comparison = compareSemver(remoteVersion, currentVersion);
  lastStatus = {
    ...lastStatus,
    checkedAt: new Date().toISOString(),
    currentVersion,
    remoteVersion,
    available: comparison > 0,
    error: null
  };
  return {
    repo: UPDATE_REPO,
    branch: UPDATE_BRANCH,
    currentVersion,
    remoteVersion,
    comparison,
    available: comparison > 0,
    remoteIsOlder: comparison < 0
  };
}

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: PROJECT_ROOT,
    maxBuffer: 4 * 1024 * 1024,
    timeout: options.timeout || 120_000,
    env: process.env
  });
  return {
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim()
  };
}

async function git(args, options = {}) {
  return run('git', ['-C', PROJECT_ROOT, ...args], options);
}

async function validateStandaloneRepository() {
  let topLevel;
  try {
    topLevel = (await git(['rev-parse', '--show-toplevel'])).stdout;
  } catch {
    throw new Error('Esta instalação não é um clone Git. Reinstale o RochaSystem pelo repositório oficial para usar atualização automática.');
  }

  const [realTop, realProject] = await Promise.all([
    fs.realpath(topLevel),
    fs.realpath(PROJECT_ROOT)
  ]);
  if (realTop !== realProject) {
    throw new Error('A atualização automática exige o RochaSystem em um repositório próprio. Esta instalação ainda está dentro de outro repositório.');
  }

  const origin = (await git(['config', '--get', 'remote.origin.url'])).stdout;
  const originRepo = normalizeRepoFromRemote(origin).toLowerCase();
  if (originRepo !== UPDATE_REPO.toLowerCase()) {
    throw new Error(`O remote origin aponta para ${origin || 'um destino desconhecido'}, mas o atualizador aceita somente ${UPDATE_REPO}.`);
  }

  const changes = (await git(['status', '--porcelain', '--untracked-files=no'])).stdout;
  if (changes) {
    throw new Error('Existem alterações locais em arquivos controlados pelo Git. O RochaSystem não vai sobrescrevê-las automaticamente.');
  }

  return { topLevel: realTop, origin };
}

async function rollbackTo(commit) {
  try {
    await git(['reset', '--hard', commit]);
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    await run(npm, ['install', '--no-audit', '--no-fund'], { timeout: 5 * 60_000 });
    return true;
  } catch (error) {
    console.error('❌ Falha ao restaurar a versão anterior do RochaSystem:', error);
    return false;
  }
}

async function installAvailableUpdate(check = null) {
  if (updateInProgress) throw new Error('Já existe uma atualização do RochaSystem em andamento.');
  updateInProgress = true;
  let oldHead = null;
  try {
    const info = check || await checkForUpdate();
    if (!info.available) return { updated: false, ...info };

    await validateStandaloneRepository();
    oldHead = (await git(['rev-parse', 'HEAD'])).stdout;
    await git(['fetch', '--quiet', 'origin', UPDATE_BRANCH], { timeout: 3 * 60_000 });

    const fetchedVersion = cleanVersion((await git(['show', `origin/${UPDATE_BRANCH}:version.txt`])).stdout);
    parseSemver(fetchedVersion);
    const currentVersion = await readLocalVersion();
    if (compareSemver(fetchedVersion, currentVersion) <= 0) {
      return {
        updated: false,
        repo: UPDATE_REPO,
        branch: UPDATE_BRANCH,
        currentVersion,
        remoteVersion: fetchedVersion,
        available: false
      };
    }

    await git(['reset', '--hard', `origin/${UPDATE_BRANCH}`]);
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    await run(npm, ['install', '--no-audit', '--no-fund'], { timeout: 5 * 60_000 });
    await run(npm, ['run', 'check'], { timeout: 5 * 60_000 });

    const installedVersion = await readLocalVersion();
    if (compareSemver(installedVersion, currentVersion) <= 0) {
      throw new Error(`A atualização não avançou a versão local (${currentVersion} -> ${installedVersion}).`);
    }

    lastStatus = {
      checkedAt: new Date().toISOString(),
      currentVersion: installedVersion,
      remoteVersion: installedVersion,
      available: false,
      updatedAt: new Date().toISOString(),
      error: null
    };

    return {
      updated: true,
      repo: UPDATE_REPO,
      branch: UPDATE_BRANCH,
      previousVersion: currentVersion,
      currentVersion: installedVersion,
      previousCommit: oldHead
    };
  } catch (error) {
    lastStatus = { ...lastStatus, error: error.message || String(error) };
    if (oldHead) {
      const restored = await rollbackTo(oldHead);
      if (!restored) error.message = `${error.message} | ATENÇÃO: também falhou ao restaurar a versão anterior.`;
    }
    throw error;
  } finally {
    updateInProgress = false;
  }
}

function scheduleRestart(delayMs = 4_000) {
  console.log(`🔄 RochaSystem será reiniciado em ${Math.round(delayMs / 1000)}s para carregar a atualização.`);
  const timer = setTimeout(() => process.exit(UPDATE_EXIT_CODE), delayMs);
  timer.unref?.();
  return timer;
}

async function automaticUpdateCheck() {
  try {
    const check = await checkForUpdate();
    if (!check.available) {
      console.log(`🔎 Atualização: local ${check.currentVersion}, remoto ${check.remoteVersion}; nenhuma versão nova.`);
      return check;
    }

    console.log(`⬆️ RochaSystem ${check.remoteVersion} disponível; atualizando automaticamente de ${check.currentVersion}...`);
    const result = await installAvailableUpdate(check);
    if (result.updated) {
      console.log(`✅ RochaSystem atualizado automaticamente: ${result.previousVersion} -> ${result.currentVersion}.`);
      scheduleRestart();
    }
    return result;
  } catch (error) {
    console.error(`⚠️ Verificação automática de atualização falhou: ${error.message || error}`);
    return null;
  }
}

function startAutoUpdateLoop({ intervalMs = UPDATE_INTERVAL_MS, initialDelayMs = UPDATE_INITIAL_DELAY_MS } = {}) {
  if (process.env.ROCHASYSTEM_AUTO_UPDATE === 'false') {
    console.log('ℹ️ Atualização automática desativada por ROCHASYSTEM_AUTO_UPDATE=false.');
    return null;
  }
  if (autoUpdateTimer || initialUpdateTimer) return autoUpdateTimer || initialUpdateTimer;

  initialUpdateTimer = setTimeout(async () => {
    initialUpdateTimer = null;
    await automaticUpdateCheck();
    autoUpdateTimer = setInterval(automaticUpdateCheck, intervalMs);
    autoUpdateTimer.unref?.();
  }, initialDelayMs);
  initialUpdateTimer.unref?.();

  console.log(`🔄 Auto-update ativo: verificação a cada ${Math.round(intervalMs / 3_600_000)} hora(s) em ${UPDATE_REPO}.`);
  return initialUpdateTimer;
}

function stopAutoUpdateLoop() {
  if (initialUpdateTimer) clearTimeout(initialUpdateTimer);
  if (autoUpdateTimer) clearInterval(autoUpdateTimer);
  initialUpdateTimer = null;
  autoUpdateTimer = null;
}

function getUpdateStatus() {
  return { ...lastStatus, repo: UPDATE_REPO, branch: UPDATE_BRANCH, inProgress: updateInProgress };
}

module.exports = {
  PROJECT_ROOT,
  VERSION_FILE,
  UPDATE_REPO,
  UPDATE_BRANCH,
  UPDATE_INTERVAL_MS,
  UPDATE_EXIT_CODE,
  cleanVersion,
  parseSemver,
  compareSemver,
  normalizeRepoFromRemote,
  remoteVersionUrl,
  readLocalVersion,
  fetchRemoteVersion,
  checkForUpdate,
  validateStandaloneRepository,
  installAvailableUpdate,
  scheduleRestart,
  automaticUpdateCheck,
  startAutoUpdateLoop,
  stopAutoUpdateLoop,
  getUpdateStatus
};
