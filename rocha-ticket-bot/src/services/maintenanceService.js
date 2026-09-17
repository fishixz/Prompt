const { getState, mutate } = require('../database/store');

const PENDING_QUESTIONNAIRE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function pruneRuntimeState() {
  const now = Date.now();
  const state = await getState();
  const stats = {
    cooldowns: 0,
    pendingQuestionnaires: 0
  };

  for (const [key, expiresAt] of Object.entries(state.cooldowns || {})) {
    if (Number(expiresAt) <= now) stats.cooldowns++;
  }

  for (const pending of Object.values(state.pendingQuestionnaires || {})) {
    const startedAt = new Date(pending.startedAt || 0).getTime();
    if (!startedAt || now - startedAt > PENDING_QUESTIONNAIRE_MAX_AGE_MS) stats.pendingQuestionnaires++;
  }

  if (!stats.cooldowns && !stats.pendingQuestionnaires) return stats;

  await mutate(db => {
    for (const [key, expiresAt] of Object.entries(db.cooldowns || {})) {
      if (Number(expiresAt) <= now) delete db.cooldowns[key];
    }

    for (const [key, pending] of Object.entries(db.pendingQuestionnaires || {})) {
      const startedAt = new Date(pending.startedAt || 0).getTime();
      if (!startedAt || now - startedAt > PENDING_QUESTIONNAIRE_MAX_AGE_MS) {
        delete db.pendingQuestionnaires[key];
      }
    }
  });

  return stats;
}

module.exports = { pruneRuntimeState, PENDING_QUESTIONNAIRE_MAX_AGE_MS };
