const fs = require('node:fs/promises');
const path = require('node:path');
const { defaultGuildConfig } = require('../config/defaultConfig');

const DB_PATH = path.join(process.cwd(), 'data', 'database.json');
const TMP_PATH = `${DB_PATH}.tmp`;

let state = null;
let writeChain = Promise.resolve();


function deepMerge(defaults, saved) {
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
  if (!defaults || typeof defaults !== 'object') return saved === undefined ? defaults : saved;
  const out = { ...defaults };
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
  for (const [key, value] of Object.entries(saved)) {
    if (key in defaults && defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) out[key] = deepMerge(defaults[key], value);
    else out[key] = value;
  }
  return out;
}

function initialState() {
  return {
    version: 1,
    guilds: {},
    tickets: {},
    questionnaireResponses: {},
    pendingQuestionnaires: {},
    ratings: {},
    cooldowns: {},
    counters: {}
  };
}

async function ensureLoaded() {
  if (state) return state;
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  try {
    state = JSON.parse(await fs.readFile(DB_PATH, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = initialState();
    await persist();
  }
  state.guilds ||= {};
  state.tickets ||= {};
  state.questionnaireResponses ||= {};
  state.pendingQuestionnaires ||= {};
  state.ratings ||= {};
  state.cooldowns ||= {};
  state.counters ||= {};
  return state;
}

async function persist() {
  if (!state) return;
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    const json = JSON.stringify(state, null, 2);
    await fs.writeFile(TMP_PATH, json, 'utf8');
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

async function backupString() {
  const db = await ensureLoaded();
  return JSON.stringify(db, null, 2);
}

module.exports = {
  DB_PATH,
  getState,
  getGuildConfig,
  saveGuildConfig,
  mutate,
  persist,
  backupString
};
