const { OverwriteType } = require('discord.js');
const { getGuildConfig, getState } = require('../database/store');
const { getTicketType } = require('./configService');

const TEXT_STAFF_ALLOW = {
  ViewChannel: true,
  SendMessages: true,
  ReadMessageHistory: true,
  AttachFiles: true,
  EmbedLinks: true,
  AddReactions: true,
  ManageMessages: true
};

const VOICE_STAFF_ALLOW = {
  ViewChannel: true,
  Connect: true,
  Speak: true,
  Stream: true
};

async function fetchChannel(guild, id) {
  if (!id) return null;
  return guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null);
}

async function syncChannelRoleOverwrites(channel, guild, desiredRoles, allowPermissions) {
  if (!channel?.permissionOverwrites) return;

  // Tickets são canais gerenciados integralmente pelo bot. Portanto, qualquer overwrite
  // de cargo que não seja @everyone e não pertença mais à equipe é considerado obsoleto.
  for (const overwrite of channel.permissionOverwrites.cache.values()) {
    const isRole = overwrite.type === OverwriteType.Role || overwrite.type === 0;
    if (!isRole || overwrite.id === guild.roles.everyone.id) continue;
    if (!desiredRoles.has(overwrite.id)) {
      await channel.permissionOverwrites.delete(overwrite.id, 'Remoção de cargo antigo da equipe do Rocha Ticket').catch(() => null);
    }
  }

  for (const roleId of desiredRoles) {
    await channel.permissionOverwrites.edit(roleId, allowPermissions, {
      reason: 'Sincronização de cargos do Rocha Ticket'
    }).catch(() => null);
  }
}

async function syncStaffRolePermissions(guild, { typeId = null } = {}) {
  const config = await getGuildConfig(guild.id);
  const db = await getState();
  const tickets = Object.values(db.tickets).filter(ticket =>
    ticket.guildId === guild.id &&
    (!typeId || ticket.typeId === typeId) &&
    ['open', 'closing', 'closed'].includes(ticket.status) &&
    ticket.channelId
  );

  let synced = 0;
  for (const ticket of tickets) {
    const type = getTicketType(config, ticket.typeId);
    const desired = new Set([
      ...(config.permissions.staffRoleIds || []),
      ...(type?.staffRoleIds || [])
    ]);

    const textChannel = await fetchChannel(guild, ticket.channelId);
    if (textChannel) await syncChannelRoleOverwrites(textChannel, guild, desired, TEXT_STAFF_ALLOW);

    const call = await fetchChannel(guild, ticket.callChannelId);
    if (call) await syncChannelRoleOverwrites(call, guild, desired, VOICE_STAFF_ALLOW);

    synced++;
  }

  return synced;
}

module.exports = { syncStaffRolePermissions };
