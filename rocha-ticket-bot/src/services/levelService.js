const { getGuildConfig, mutate } = require('../database/store');
const { ensureSystemConfig } = require('./accessControlService');

const messageCooldowns = new Map();

function ensureLevelConfig(system) {
  system.levels ||= {};
  system.levels.enabled = system.levels.enabled !== false;
  system.levels.xpMin = Math.max(1, Math.min(100, Number(system.levels.xpMin) || 5));
  system.levels.xpMax = Math.max(system.levels.xpMin, Math.min(250, Number(system.levels.xpMax) || 15));
  system.levels.cooldownSeconds = Math.max(5, Math.min(3600, Number(system.levels.cooldownSeconds) || 60));
  return system.levels;
}

function xpForLevel(level) {
  const l = Math.max(0, Number(level) || 0);
  return 100 + (l * 75);
}

function levelFromXp(totalXp) {
  let remaining = Math.max(0, Number(totalXp) || 0);
  let level = 0;
  while (remaining >= xpForLevel(level) && level < 1000) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return { level, currentXp: remaining, requiredXp: xpForLevel(level) };
}

async function getLevelProfile(guildId, userId) {
  const db = await require('../database/store').getState();
  db.levels ||= {};
  db.levels[guildId] ||= {};
  const raw = db.levels[guildId][userId] || { xp: 0, messages: 0, updatedAt: null };
  return { ...raw, ...levelFromXp(raw.xp) };
}

async function addMessageXp(message) {
  if (!message.guild || message.author?.bot || !message.content?.trim()) return null;
  const config = await getGuildConfig(message.guild.id);
  const settings = ensureLevelConfig(ensureSystemConfig(config));
  if (!settings.enabled) return null;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const until = messageCooldowns.get(key) || 0;
  if (until > now) return null;
  messageCooldowns.set(key, now + (settings.cooldownSeconds * 1000));

  const gained = settings.xpMin + Math.floor(Math.random() * (settings.xpMax - settings.xpMin + 1));
  return mutate(db => {
    db.levels ||= {};
    db.levels[message.guild.id] ||= {};
    const profile = db.levels[message.guild.id][message.author.id] ||= { xp: 0, messages: 0, updatedAt: null };
    const before = levelFromXp(profile.xp).level;
    profile.xp += gained;
    profile.messages += 1;
    profile.updatedAt = new Date().toISOString();
    const after = levelFromXp(profile.xp).level;
    return { gained, beforeLevel: before, afterLevel: after, profile: { ...profile, ...levelFromXp(profile.xp) } };
  });
}

async function handleLevelMessage(message) {
  const result = await addMessageXp(message);
  if (!result || result.afterLevel <= result.beforeLevel) return false;
  await message.channel.send(`🎉 ${message.author}, você alcançou o **nível ${result.afterLevel}** no RochaSystem!`).catch(() => null);
  return true;
}

async function getRanking(guildId, limit = 10) {
  const db = await require('../database/store').getState();
  db.levels ||= {};
  const entries = Object.entries(db.levels[guildId] || {})
    .map(([userId, profile]) => ({ userId, ...profile, ...levelFromXp(profile.xp) }))
    .sort((a, b) => (b.xp || 0) - (a.xp || 0));
  return entries.slice(0, Math.max(1, Math.min(25, limit)));
}

module.exports = {
  ensureLevelConfig,
  xpForLevel,
  levelFromXp,
  getLevelProfile,
  getRanking,
  addMessageXp,
  handleLevelMessage
};
