const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { getGuildConfig, getState, mutate } = require('../database/store');
const { getTicketType, logChannelFor } = require('./configService');
const { buildVariables, renderTemplate } = require('../utils/variables');
const { colorInt } = require('../utils/discord');

function ratingKey(ticketUid) {
  return ticketUid;
}

function buildRatingPayload(config, guild, ticket, type) {
  const vars = buildVariables({ guild, ticket, ticketType: type, config });
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle(renderTemplate(config.rating.promptTitle, vars))
    .setDescription(renderTemplate(config.rating.promptText, vars));
  const row = new ActionRowBuilder();
  for (let i = 1; i <= Math.min(5, Number(config.rating.scale) || 5); i++) {
    row.addComponents(new ButtonBuilder().setCustomId(`rating:pick:${ticket.uid}:${i}`).setLabel(`${i}`).setEmoji('⭐').setStyle(ButtonStyle.Secondary));
  }
  return { embeds: [embed], components: [row] };
}

async function getRating(ticketUid) {
  const db = await getState();
  return db.ratings[ratingKey(ticketUid)] || null;
}

async function createRatingRecord(ticket, mode) {
  return mutate(db => {
    db.ratings[ratingKey(ticket.uid)] = {
      ticketUid: ticket.uid,
      guildId: ticket.guildId,
      userId: ticket.userId,
      mode,
      value: null,
      comment: null,
      createdAt: new Date().toISOString(),
      answeredAt: null
    };
    return db.ratings[ratingKey(ticket.uid)];
  });
}

async function saveRating(ticketUid, value, comment) {
  return mutate(db => {
    const r = db.ratings[ratingKey(ticketUid)];
    if (!r) return null;
    if (r.answeredAt) return r;
    r.value = Number(value);
    r.comment = comment || '';
    r.answeredAt = new Date().toISOString();
    return r;
  });
}

async function sendRatingPrompt(guild, ticket, ticketType, channel, user) {
  const config = await getGuildConfig(guild.id);
  if (!config.rating.enabled) return { sent: false, mode: 'off' };
  const mode = config.rating.mode;
  const payload = buildRatingPayload(config, guild, ticket, ticketType);
  await createRatingRecord(ticket, mode);
  const result = { sent: false, dm: false, ticket: false, mode };
  if (mode === 'dm' || mode === 'both') {
    try {
      await user.send(payload);
      result.sent = true;
      result.dm = true;
    } catch {}
  }
  if ((mode === 'ticket' || mode === 'both') && channel?.isTextBased()) {
    try {
      await channel.send({ content: `<@${user.id}>`, ...payload });
      result.sent = true;
      result.ticket = true;
    } catch {}
  }
  return result;
}

async function sendRatingLog(guild, ticket, ticketType, rating) {
  const config = await getGuildConfig(guild.id);
  const channelId = ticketType?.logChannelIds?.rating || config.rating.logChannelId || logChannelFor(config, 'rating', ticketType);
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const stars = '⭐'.repeat(Math.max(1, Math.min(5, rating.value || 0)));
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle('⭐ Nova avaliação de atendimento')
    .setDescription(`**Ticket:** #${String(ticket.number).padStart(4, '0')}\n**Usuário:** <@${ticket.userId}>\n**Tipo:** ${ticketType?.name || ticket.typeName}\n**Atendente:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : '_não assumido_'}\n**Nota:** ${stars} (${rating.value}/5)\n**Comentário:** ${rating.comment || '_sem comentário_'}`)
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => null);
}

async function thankUser(interaction, config) {
  const embed = new EmbedBuilder().setColor(0x20bf6b).setDescription(config.rating.thanksText || 'Obrigado pela sua avaliação!');
  if (interaction.isModalSubmit()) return interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
  return interaction.update({ embeds: [embed], components: [] }).catch(async () => interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null));
}

module.exports = {
  buildRatingPayload,
  getRating,
  createRatingRecord,
  saveRating,
  sendRatingPrompt,
  sendRatingLog,
  thankUser
};
