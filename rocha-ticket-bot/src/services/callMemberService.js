const { MessageFlags } = require('discord.js');
const { getGuildConfig } = require('../database/store');
const { getTicketByUid } = require('./ticketService');
const { getTicketType } = require('./configService');
const { canManageTicket } = require('../utils/permissions');

async function handleCallMemberSelect(interaction) {
  if (!interaction.customId?.startsWith('ticket:callmembersel:')) return false;

  const uid = interaction.customId.split(':')[2];
  const ticket = await getTicketByUid(uid);
  if (!ticket || ticket.guildId !== interaction.guildId) {
    return interaction.update({ content: '❌ Ticket não encontrado.', components: [] });
  }
  if (ticket.status !== 'open') {
    return interaction.update({ content: '⚠️ Este ticket não está mais ativo.', components: [] });
  }

  const config = await getGuildConfig(interaction.guildId);
  const type = getTicketType(config, ticket.typeId);
  if (!await canManageTicket(interaction, type)) {
    return interaction.reply({ content: '❌ Este controle é exclusivo para a equipe responsável.', flags: MessageFlags.Ephemeral });
  }

  const userId = interaction.values[0];
  const target = await interaction.client.users.fetch(userId).catch(() => null);
  if (!target) return interaction.update({ content: '❌ Não consegui localizar esse usuário.', components: [] });

  const ticketUrl = `https://discord.com/channels/${interaction.guildId}/${ticket.channelId}`;
  let dmSent = false;
  try {
    await target.send({
      content: [
        `🔔 **Você foi chamado para um atendimento no ${interaction.guild.name}.**`,
        `Chamado por: **${interaction.user.tag}**`,
        `Ticket: **#${String(ticket.number).padStart(4, '0')} • ${type?.name || ticket.typeName}**`,
        '',
        `Acessar: ${ticketUrl}`,
        '',
        'Se o canal não abrir, você ainda não possui permissão para visualizar esse tipo de atendimento.'
      ].join('\n')
    });
    dmSent = true;
  } catch {}

  await interaction.channel.send({
    content: `🔔 <@${userId}>, você foi chamado por ${interaction.user} para auxiliar neste atendimento.${dmSent ? ' Uma DM com o link também foi enviada.' : ' Não foi possível enviar DM.'}`
  }).catch(() => null);

  return interaction.update({
    content: dmSent
      ? `✅ <@${userId}> foi chamado e recebeu o link do ticket por DM.`
      : `⚠️ <@${userId}> foi mencionado, mas a DM está bloqueada ou indisponível.`,
    components: []
  });
}

module.exports = { handleCallMemberSelect };
