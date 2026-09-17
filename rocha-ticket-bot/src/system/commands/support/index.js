const { EmbedBuilder } = require('discord.js');
const { getState, getGuildConfig } = require('../../../database/store');
const { colorInt, truncate } = require('../../../utils/discord');

function commandIdForSubcommand(subcommand) {
  return `suporte.${subcommand}`;
}

function guildTickets(db, guildId) {
  return Object.values(db.tickets || {}).filter(ticket => ticket.guildId === guildId);
}

async function executeSupport(interaction, subcommand) {
  const db = await getState();
  const config = await getGuildConfig(interaction.guildId);
  const tickets = guildTickets(db, interaction.guildId);

  if (subcommand === 'abertos') {
    const open = tickets.filter(ticket => ticket.status === 'open' || ticket.status === 'creating');
    const lines = open.slice(0, 20).map(ticket => `• **#${ticket.number ?? ticket.uid}** • <@${ticket.userId}> • ${ticket.channelId ? `<#${ticket.channelId}>` : '`criando`'}${ticket.claimedBy ? ` • por <@${ticket.claimedBy}>` : ''}`);
    const embed = new EmbedBuilder()
      .setColor(colorInt(config.branding?.color || '#F5A300'))
      .setTitle('🎧 Tickets abertos • RochaSystem')
      .setDescription(lines.length ? lines.join('\n') : '_Nenhum ticket aberto no momento._')
      .setFooter({ text: `Total ativo: ${open.length}` })
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === 'meus') {
    const mine = tickets.filter(ticket => ticket.claimedBy === interaction.user.id);
    const open = mine.filter(ticket => ticket.status === 'open').length;
    const closed = mine.filter(ticket => ticket.status === 'closed').length;
    const recent = mine.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 10);
    const lines = recent.map(ticket => `• **#${ticket.number ?? ticket.uid}** • <@${ticket.userId}> • \`${ticket.status}\``).join('\n') || '_Você ainda não assumiu atendimentos registrados._';
    const embed = new EmbedBuilder()
      .setColor(colorInt(config.branding?.color || '#F5A300'))
      .setTitle(`🎧 Meus atendimentos • ${interaction.user.username}`)
      .setDescription(lines)
      .addFields(
        { name: 'Total assumido', value: String(mine.length), inline: true },
        { name: 'Abertos', value: String(open), inline: true },
        { name: 'Fechados', value: String(closed), inline: true }
      );
    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === 'usuario') {
    const user = interaction.options.getUser('usuario', true);
    const found = tickets.filter(ticket => ticket.userId === user.id)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const lines = found.slice(0, 20).map(ticket => `• **#${ticket.number ?? ticket.uid}** • \`${ticket.status}\` • ${ticket.channelId ? `<#${ticket.channelId}>` : '`sem canal`'} • tipo \`${ticket.typeId || 'desconhecido'}\``).join('\n') || '_Nenhum ticket encontrado para este usuário._';
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(colorInt(config.branding?.color || '#F5A300'))
        .setTitle(`🎧 Histórico de tickets • ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 128 }))
        .setDescription(truncate(lines, 4096))
        .setFooter({ text: `Total encontrado: ${found.length}` })]
    });
  }

  if (subcommand === 'estatisticas') {
    const open = tickets.filter(ticket => ticket.status === 'open').length;
    const closed = tickets.filter(ticket => ticket.status === 'closed').length;
    const creating = tickets.filter(ticket => ticket.status === 'creating').length;
    const claimed = tickets.filter(ticket => ticket.claimedBy).length;
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(colorInt(config.branding?.color || '#F5A300'))
        .setTitle('📊 Estatísticas de suporte • RochaSystem')
        .addFields(
          { name: 'Histórico total', value: String(tickets.length), inline: true },
          { name: 'Abertos', value: String(open), inline: true },
          { name: 'Criando', value: String(creating), inline: true },
          { name: 'Fechados', value: String(closed), inline: true },
          { name: 'Já assumidos', value: String(claimed), inline: true }
        )
        .setTimestamp()]
    });
  }

  throw new Error(`Subcomando de suporte não implementado: ${subcommand}`);
}

module.exports = { commandIdForSubcommand, executeSupport };
