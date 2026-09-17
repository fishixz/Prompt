const { getGuildConfig } = require('../database/store');
const { ensureSystemConfig, isOwnerFromConfig, memberHasRole } = require('./accessControlService');
const { sendSystemAudit } = require('./systemAuditService');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeWord(value) {
  return normalizeText(value).trim().replace(/\s+/g, ' ');
}

function blockedWordInText(text, words = []) {
  const normalized = ` ${normalizeText(text).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  return words.find(word => {
    const needle = normalizeWord(word).replace(/[^a-z0-9]+/g, ' ').trim();
    return needle && normalized.includes(` ${needle} `);
  }) || null;
}

function ensureAutomod(system) {
  system.automod ||= {};
  system.automod.enabled = Boolean(system.automod.enabled);
  system.automod.deleteMessage = system.automod.deleteMessage !== false;
  system.automod.notifyUser = system.automod.notifyUser !== false;
  system.automod.words = Array.isArray(system.automod.words) ? [...new Set(system.automod.words.map(normalizeWord).filter(Boolean))] : [];
  return system.automod;
}

function isExempt(config, guild, member, userId) {
  if (!member) return false;
  if (isOwnerFromConfig(config, guild, member, userId)) return true;
  const system = ensureSystemConfig(config);
  return memberHasRole(member, system.access?.moderador?.roleIds || []);
}

async function handleAutomodMessage(message) {
  if (!message.guild || message.author?.bot || !message.content) return false;
  const config = await getGuildConfig(message.guild.id);
  const system = ensureSystemConfig(config);
  const automod = ensureAutomod(system);
  if (!automod.enabled || !automod.words.length) return false;
  if (isExempt(config, message.guild, message.member, message.author.id)) return false;

  const matched = blockedWordInText(message.content, automod.words);
  if (!matched) return false;

  if (automod.deleteMessage && message.deletable) await message.delete().catch(() => null);
  if (automod.notifyUser && message.channel?.isTextBased?.()) {
    const notice = await message.channel.send({
      content: `⚠️ ${message.author}, sua mensagem foi bloqueada pelo AutoMod do RochaSystem.`
    }).catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => null), 6000).unref?.();
  }

  await sendSystemAudit(message.guild, {
    action: 'AutoMod • mensagem bloqueada',
    actor: message.author,
    details: `Canal: ${message.channel} • Palavra detectada: \`${matched}\``
  }).catch(() => null);
  return true;
}

module.exports = {
  normalizeText,
  normalizeWord,
  blockedWordInText,
  ensureAutomod,
  handleAutomodMessage
};
