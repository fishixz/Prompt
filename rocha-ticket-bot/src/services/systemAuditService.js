const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../database/store');
const { ensureSystemConfig } = require('./accessControlService');
const { colorInt, truncate } = require('../utils/discord');

async function sendSystemAudit(guild, {
  action,
  actor = null,
  target = null,
  reason = null,
  details = null,
  color = null
} = {}) {
  try {
    const config = await getGuildConfig(guild.id);
    const system = ensureSystemConfig(config);
    const channelId = system.audit.channelId || config.logs?.defaultChannelId || null;
    if (!channelId) return null;

    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return null;

    const description = [];
    if (actor) description.push(`**Responsável:** ${actor} • \`${actor.id}\``);
    if (target) description.push(`**Alvo:** ${target} • \`${target.id || 'sem-id'}\``);
    if (reason) description.push(`**Motivo:** ${truncate(reason, 1000)}`);
    if (details) description.push(`**Detalhes:** ${truncate(details, 1500)}`);

    const embed = new EmbedBuilder()
      .setColor(color ?? colorInt(config.branding?.color || '#F5A300'))
      .setTitle(truncate(`🦊 RochaSystem • ${action || 'Ação administrativa'}`, 256))
      .setDescription(description.join('\n') || 'Ação registrada.')
      .setTimestamp();

    return channel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[RochaSystem Audit]', error);
    return null;
  }
}

module.exports = { sendSystemAudit };
