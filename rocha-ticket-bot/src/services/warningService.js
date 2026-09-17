const crypto = require('node:crypto');
const { getState, mutate } = require('../database/store');

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

async function listWarnings(guildId, userId) {
  const db = await getState();
  db.moderationWarnings ||= {};
  return [...(db.moderationWarnings[key(guildId, userId)] || [])];
}

async function addWarning(guildId, userId, moderatorId, reason) {
  return mutate(db => {
    db.moderationWarnings ||= {};
    const k = key(guildId, userId);
    db.moderationWarnings[k] ||= [];
    const warning = {
      id: crypto.randomBytes(4).toString('hex'),
      guildId,
      userId,
      moderatorId,
      reason: String(reason || 'Sem motivo informado.').slice(0, 1500),
      createdAt: new Date().toISOString()
    };
    db.moderationWarnings[k].push(warning);
    return warning;
  });
}

async function clearWarnings(guildId, userId) {
  return mutate(db => {
    db.moderationWarnings ||= {};
    const k = key(guildId, userId);
    const count = db.moderationWarnings[k]?.length || 0;
    delete db.moderationWarnings[k];
    return count;
  });
}

async function removeWarning(guildId, userId, warningId) {
  return mutate(db => {
    db.moderationWarnings ||= {};
    const k = key(guildId, userId);
    const list = db.moderationWarnings[k] || [];
    const before = list.length;
    db.moderationWarnings[k] = list.filter(warning => warning.id !== warningId);
    if (!db.moderationWarnings[k].length) delete db.moderationWarnings[k];
    return before !== (db.moderationWarnings[k]?.length || 0);
  });
}

module.exports = { listWarnings, addWarning, clearWarnings, removeWarning };
