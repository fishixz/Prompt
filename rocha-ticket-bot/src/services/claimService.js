const { MessageFlags } = require('discord.js');
const { getGuildConfig } = require('../database/store');
const { getTicketByUid, setClaimed } = require('./ticketService');
const { getTicketType } = require('./configService');
const { canManageTicket } = require('../utils/permissions');
const { buildVariables, renderTemplate } = require('../utils/variables');
const { sendLog } = require('./logService');

const EPHEMERAL = MessageFlags.Ephemeral;

async function handleClaimButton(interaction) {
  if (!interaction.customId?.startsWith('ticket:claim:')) return false;
  const uid = interaction.customId.split(':')[2];
  const ticket = await getTicketByUid(uid);
  if (!ticket || ticket.guildId !== interaction.guildId) {
    return interaction.reply({ content: '❌ Ticket não encontrado.', flags: EPHEMERAL });
  }
  if (ticket.status !== 'open') {
    return interaction.reply({ content: '⚠️ Este ticket não está mais ativo.', flags: EPHEMERAL });
  }

  const config = await getGuildConfig(interaction.guildId);
  const type = getTicketType(config, ticket.typeId);
  if (!await canManageTicket(interaction, type)) {
    return interaction.reply({ content: '❌ Este controle é exclusivo para a equipe responsável.', flags: EPHEMERAL });
  }
  if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
    return interaction.reply({ content: `⚠️ Este atendimento já foi assumido por <@${ticket.claimedBy}>.`, flags: EPHEMERAL });
  }
  if (ticket.claimedBy === interaction.user.id) {
    return interaction.reply({ content: '✅ Este atendimento já está assumido por você.', flags: EPHEMERAL });
  }

  const claimed = await setClaimed(uid, interaction.member || interaction.user);
  const vars = buildVariables({
    guild: interaction.guild,
    ticket: claimed || { ...ticket, claimedBy: interaction.user.id },
    ticketType: type,
    channel: interaction.channel,
    staff: interaction.member || interaction.user,
    config
  });

  await interaction.channel.send({ content: renderTemplate(config.templates.claimText, vars) });
  await sendLog(interaction.guild, 'ticket_claim', {
    ticket: claimed || ticket,
    ticketType: type,
    title: '😉 Atendimento assumido',
    description: `${interaction.user} assumiu <#${ticket.channelId}>.`
  });

  return interaction.reply({ content: '✅ Atendimento assumido por você.', flags: EPHEMERAL });
}

module.exports = { handleClaimButton };
