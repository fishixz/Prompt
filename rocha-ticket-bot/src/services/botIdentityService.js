const { ActivityType } = require('discord.js');
const { getGuildConfig, saveGuildConfig } = require('../database/store');
const { ensureSystemConfig, DEFAULT_BIO } = require('./accessControlService');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const VALID_STATUS = new Set(['online', 'idle', 'dnd', 'invisible']);

async function imageBufferFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL de imagem inválida.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('A imagem deve usar HTTP ou HTTPS.');

  const response = await fetch(parsed, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Não foi possível baixar a imagem (HTTP ${response.status}).`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error('O endereço informado não retornou uma imagem.');
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_IMAGE_BYTES) throw new Error('A imagem ultrapassa o limite de 10 MB do RochaSystem.');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error('A imagem recebida está vazia.');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('A imagem ultrapassa o limite de 10 MB do RochaSystem.');
  return buffer;
}

async function setBotName(client, guildId, name) {
  const value = String(name || '').trim();
  if (value.length < 2 || value.length > 32) throw new Error('O nome deve ter entre 2 e 32 caracteres.');
  await client.user.setUsername(value);
  const config = await getGuildConfig(guildId);
  ensureSystemConfig(config).identity.name = value;
  await saveGuildConfig(guildId, config);
  return value;
}

async function setBotBio(client, guildId, bio) {
  const value = String(bio ?? '').trim();
  if (!value) throw new Error('A descrição não pode ficar vazia.');
  if (value.length > 400) throw new Error('A descrição pode ter no máximo 400 caracteres.');
  await client.application.fetch().catch(() => null);
  if (typeof client.application?.edit !== 'function') throw new Error('Esta versão do discord.js não permite alterar a descrição da aplicação por este método.');
  await client.application.edit({ description: value });
  const config = await getGuildConfig(guildId);
  ensureSystemConfig(config).identity.bio = value;
  await saveGuildConfig(guildId, config);
  return value;
}

async function setBotAvatar(client, guildId, url) {
  const buffer = await imageBufferFromUrl(url);
  await client.user.setAvatar(buffer);
  const config = await getGuildConfig(guildId);
  ensureSystemConfig(config).identity.avatarUrl = url;
  await saveGuildConfig(guildId, config);
  return url;
}

async function setBotBanner(client, guildId, url) {
  if (typeof client.user.setBanner !== 'function') throw new Error('O método de alteração de banner não está disponível nesta versão do discord.js.');
  const buffer = await imageBufferFromUrl(url);
  await client.user.setBanner(buffer);
  const config = await getGuildConfig(guildId);
  ensureSystemConfig(config).identity.bannerUrl = url;
  await saveGuildConfig(guildId, config);
  return url;
}

async function setBotPresence(client, guildId, status, activity) {
  const normalized = VALID_STATUS.has(status) ? status : 'online';
  const activityText = String(activity || '').trim().slice(0, 128);
  client.user.setPresence({
    status: normalized,
    activities: activityText ? [{ name: activityText, type: ActivityType.Watching }] : []
  });
  const config = await getGuildConfig(guildId);
  const identity = ensureSystemConfig(config).identity;
  identity.status = normalized;
  identity.activity = activityText;
  await saveGuildConfig(guildId, config);
  return { status: normalized, activity: activityText };
}

async function applySystemIdentity(client, config) {
  const identity = ensureSystemConfig(config).identity;
  const result = { name: false, bio: false, presence: false, errors: [] };

  try {
    if (identity.name && client.user.username !== identity.name) {
      await client.user.setUsername(identity.name);
      result.name = true;
    }
  } catch (error) {
    result.errors.push(`nome: ${error.message}`);
  }

  try {
    await client.application.fetch().catch(() => null);
    const desiredBio = identity.bio || DEFAULT_BIO;
    if (desiredBio && client.application?.description !== desiredBio && typeof client.application?.edit === 'function') {
      await client.application.edit({ description: desiredBio });
      result.bio = true;
    }
  } catch (error) {
    result.errors.push(`bio: ${error.message}`);
  }

  try {
    client.user.setPresence({
      status: VALID_STATUS.has(identity.status) ? identity.status : 'online',
      activities: identity.activity ? [{ name: identity.activity, type: ActivityType.Watching }] : []
    });
    result.presence = true;
  } catch (error) {
    result.errors.push(`presença: ${error.message}`);
  }

  return result;
}

module.exports = {
  MAX_IMAGE_BYTES,
  VALID_STATUS,
  imageBufferFromUrl,
  setBotName,
  setBotBio,
  setBotAvatar,
  setBotBanner,
  setBotPresence,
  applySystemIdentity
};
