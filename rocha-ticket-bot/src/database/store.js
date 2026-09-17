const fs = require('node:fs/promises');
const path = require('node:path');
const { defaultGuildConfig } = require('../config/defaultConfig');

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'database.json');
const TMP_PATH = `${DB_PATH}.tmp`;
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

let state = null;
let writeChain = Promise.resolve();

function deepMerge(defaults, saved) {
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
  if (!defaults || typeof defaults !== 'object') return saved === undefined ? defaults : saved;
  const out = { ...defaults };
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
  for (const [key, value] of Object.entries(saved)) {
    if (key in defaults && defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      out[key] = deepMerge(defaults[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function initialState() {
  return {
    version: 3,
    guilds: {},
    tickets: {},
    questionnaireResponses: {},
    pendingQuestionnaires: {},
    ratings: {},
    cooldowns: {},
    counters: {},
    moderationWarnings: {},
    levels: {}
  };
}

function normalizeState(db) {
  if (!db || typeof db !== 'object' || Array.isArray(db)) throw new Error('Estrutura do banco JSON inválida.');
  db.version = Math.max(3, Number(db.version) || 1);
  db.guilds ||= {};
  db.tickets ||= {};
  db.questionnaireResponses ||= {};
  db.pendingQuestionnaires ||= {};
  db.ratings ||= {};
  db.cooldowns ||= {};
  db.counters ||= {};
  db.moderationWarnings ||= {};
  db.levels ||= {};
  return db;
}

async function readValidJson(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return normalizeState(JSON.parse(text));
  } catch {
    return null;
  }
}

async function preserveCorruptDatabase() {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(DATA_DIR, `database.corrupt-${stamp}.json`);
    await fs.copyFile(DB_PATH, target);
    console.error(`🧯 Banco corrompido preservado em ${target}`);
    return target;
  } catch {
    return null;
  }
}

async function recoverDatabase() {
  const temp = await readValidJson(TMP_PATH);
  if (temp) {
    console.warn('⚠️ database.json inválido. Recuperando a versão temporária válida.');
    return { state: temp, source: TMP_PATH };
  }

  try {
    const files = (await fs.readdir(BACKUP_DIR))
      .filter(name => name.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    for (const name of files) {
      const filePath = path.join(BACKUP_DIR, name);
      const recovered = await readValidJson(filePath);
      if (recovered) {
        console.warn(`⚠️ database.json inválido. Recuperando backup ${name}.`);
        return { state: recovered, source: filePath };
      }
    }
  } catch {}

  return null;
}

async function ensureLoaded() {
  if (state) return state;
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    state = normalizeState(JSON.parse(await fs.readFile(DB_PATH, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') {
      state = initialState();
      await persist();
      return state;
    }

    await preserveCorruptDatabase();
    const recovered = await recoverDatabase();
    if (!recovered) {
      const fatal = new Error('O banco data/database.json está inválido e nenhum backup válido foi encontrado. O arquivo não foi apagado para evitar perda de dados.');
      fatal.cause = error;
      throw fatal;
    }

    state = recovered.state;
    await persist();
    console.warn(`✅ Banco restaurado automaticamente a partir de ${recovered.source}.`);
  }

  return normalizeState(state);
}

async function persist() {
  if (!state) return;
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const json = JSON.stringify(state, null, 2);
    await fs.writeFile(TMP_PATH, json, 'utf8');
    JSON.parse(await fs.readFile(TMP_PATH, 'utf8'));
    await fs.rename(TMP_PATH, DB_PATH);
  });
  return writeChain;
}

async function getState() {
  return ensureLoaded();
}

async function getGuildConfig(guildId) {
  const db = await ensureLoaded();
  const defaults = defaultGuildConfig(guildId);
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = defaults;
    await persist();
  } else {
    const merged = deepMerge(defaults, db.guilds[guildId]);
    if (JSON.stringify(merged) !== JSON.stringify(db.guilds[guildId])) {
      db.guilds[guildId] = merged;
      await persist();
    }
  }
  return db.guilds[guildId];
}

async function saveGuildConfig(guildId, config) {
  const db = await ensureLoaded();
  db.guilds[guildId] = config;
  await persist();
  return config;
}

async function mutate(mutator) {
  const db = await ensureLoaded();
  const result = await mutator(db);
  await persist();
  return result;
}

async function replaceState(snapshot) {
  const next = normalizeState(JSON.parse(JSON.stringify(snapshot)));
  state = next;
  await persist();
  return state;
}

async function backupString() {
  const db = await ensureLoaded();
  return JSON.stringify(db, null, 2);
}

module.exports = {
  DATA_DIR,
  DB_PATH,
  TMP_PATH,
  BACKUP_DIR,
  getState,
  getGuildConfig,
  saveGuildConfig,
  mutate,
  replaceState,
  persist,
  backupString,
  normalizeState,
  readValidJson
};
