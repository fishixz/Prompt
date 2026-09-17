const { getState, mutate } = require('../database/store');

function cooldownKey(guildId, userId, scope = 'default') {
  return `${guildId}:${userId}:${scope}`;
}

async function consumeCooldown(guildId, userId, scope, seconds) {
  const durationMs = Math.max(0, Number(seconds) || 0) * 1000;
  if (!durationMs) return { allowed: true, retryAfterMs: 0 };

  const key = cooldownKey(guildId, userId, scope);
  const now = Date.now();
  const db = await getState();
  const expiresAt = Number(db.cooldowns[key] || 0);

  if (expiresAt > now) {
    return { allowed: false, retryAfterMs: expiresAt - now };
  }

  await mutate(state => {
    state.cooldowns[key] = now + durationMs;

    // Limpeza oportunista para o JSON não crescer indefinidamente.
    for (const [storedKey, value] of Object.entries(state.cooldowns)) {
      if (Number(value) <= now) delete state.cooldowns[storedKey];
    }
  });

  return { allowed: true, retryAfterMs: 0 };
}

module.exports = { cooldownKey, consumeCooldown };
