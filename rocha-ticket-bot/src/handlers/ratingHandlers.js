const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { getGuildConfig } = require('../database/store');
const { getTicketByUid, updateTicket } = require('../services/ticketService');
const { getTicketType } = require('../services/configService');
const { getRating, saveRating, sendRatingLog, thankUser } = require('../services/ratingService');

async function ratingContext(interaction, uid) {
  const ticket = await getTicketByUid(uid);
  if (!ticket) return { error: 'Ticket não encontrado.' };
  if (ticket.userId !== interaction.user.id) return { error: 'Esta avaliação pertence a outro usuário.' };
  const guild = interaction.client.guilds.cache.get(ticket.guildId) || await interaction.client.guilds.fetch(ticket.guildId).catch(() => null);
  if (!guild) return { error: 'Servidor não encontrado.' };
  const config = await getGuildConfig(ticket.guildId);
  const type = getTicketType(config, ticket.typeId);
  return { ticket, guild, config, type };
}

async function finalizeRating(interaction, ctx, value, comment = '') {
  const current = await getRating(ctx.ticket.uid);
  if (!current) return interaction.reply({ content: 'Esta avaliação não está mais disponível.', ephemeral: true });
  if (current.answeredAt) return interaction.reply({ content: '✅ Você já avaliou este atendimento.', ephemeral: true });
  const rating = await saveRating(ctx.ticket.uid, value, comment);
  await sendRatingLog(ctx.guild, ctx.ticket, ctx.type, rating);

  if (['ticket', 'both'].includes(ctx.config.rating.mode)) {
    await updateTicket(ctx.ticket.uid, { deleteAt: new Date(Date.now() + 3000).toISOString() });
  }
  return thankUser(interaction, ctx.config);
}

async function handleRatingButton(interaction) {
  if (!interaction.customId.startsWith('rating:pick:')) return false;
  const [, , uid, rawValue] = interaction.customId.split(':');
  const ctx = await ratingContext(interaction, uid);
  if (ctx.error) return interaction.reply({ content: `❌ ${ctx.error}`, ephemeral: true });
  const value = Number(rawValue);
  if (ctx.config.rating.requireComment) {
    const input = new TextInputBuilder().setCustomId('comment').setLabel('Conte como foi seu atendimento').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
    const modal = new ModalBuilder().setCustomId(`rating:submit:${uid}:${value}`).setTitle(`Avaliação ${value}/5`).addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }
  return finalizeRating(interaction, ctx, value, '');
}

async function handleRatingModal(interaction) {
  if (!interaction.customId.startsWith('rating:submit:')) return false;
  const [, , uid, rawValue] = interaction.customId.split(':');
  const ctx = await ratingContext(interaction, uid);
  if (ctx.error) return interaction.reply({ content: `❌ ${ctx.error}`, ephemeral: true });
  const comment = interaction.fields.getTextInputValue('comment').trim();
  return finalizeRating(interaction, ctx, Number(rawValue), comment);
}

module.exports = { handleRatingButton, handleRatingModal };
