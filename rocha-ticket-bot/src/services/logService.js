const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getGuildConfig } = require('../database/store');
const { logChannelFor } = require('./configService');
const { colorInt, truncate } = require('../utils/discord');

async function sendLog(guild, eventName, { ticket = null, ticketType = null, title, description, fields = [], file = null, color = null } = {}) {
  try {
    const config = await getGuildConfig(guild.id);
    const channelId = logChannelFor(config, eventName, ticketType);
    if (!channelId) return null;
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return null;

    const embed = new EmbedBuilder()
      .setColor(color ?? colorInt(config.branding.color))
      .setTitle(truncate(title || `Log • ${eventName}`, 256))
      .setDescription(truncate(description || 'Evento registrado.', 4096))
      .setTimestamp();

    if (fields?.length) {
      embed.addFields(fields.slice(0, 25).map(f => ({
        name: truncate(f.name, 256),
        value: truncate(f.value, 1024),
        inline: Boolean(f.inline)
      })));
    }
    if (ticket) embed.setFooter({ text: `Ticket #${String(ticket.number).padStart(4, '0')} • ${ticket.uid}` });

    const payload = { embeds: [embed] };
    if (file) payload.files = [file instanceof AttachmentBuilder ? file : new AttachmentBuilder(file.buffer, { name: file.name })];
    return await channel.send(payload);
  } catch (error) {
    console.error(`[LOG:${eventName}]`, error);
    return null;
  }
}

module.exports = { sendLog };
