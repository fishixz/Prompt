const { getGuildConfig, getState, mutate } = require('../database/store');
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

async function syncStaffRolePermissions(guild, { typeId = null, roleIdsToRemove = [] } = {}) {
  const config = await getGuildConfig(guild.id);
  const db = await getState();
  const tickets = Object.values(db.tickets).filter(ticket =>
    ticket.guildId === guild.id &&
    (!typeId || ticket.typeId === typeId) &&
    ['open', 'closing', 'closed'].includes(ticket.status) &&
    ticket.channelId
  );

  const snapshots = new Map();
  let synced = 0;

  for (const ticket of tickets) {
    const type = getTicketType(config, ticket.typeId);
    const desired = new Set([
      ...(config.permissions.staffRoleIds || []),
      ...(type?.staffRoleIds || [])
    ]);
    const previous = new Set([
      ...(ticket.syncedStaffRoleIds || []),
      ...roleIdsToRemove
    ]);

    const textChannel = await fetchChannel(guild, ticket.channelId);
    if (textChannel) {
      for (const roleId of previous) {
        if (!desired.has(roleId)) {
          await textChannel.permissionOverwrites.delete(roleId, 'Sincronização de cargos do Rocha Ticket').catch(() => null);
        }
      }
      for (const roleId of desired) {
        await textChannel.permissionOverwrites.edit(roleId, TEXT_STAFF_ALLOW, { reason: 'Sincronização de cargos do Rocha Ticket' }).catch(() => null);
      }
    }

    const call = await fetchChannel(guild, ticket.callChannelId);
    if (call) {
      for (const roleId of previous) {
        if (!desired.has(roleId)) {
          await call.permissionOverwrites.delete(roleId, 'Sincronização de cargos do Rocha Ticket').catch(() => null);
        }
      }
      for (const roleId of desired) {
        await call.permissionOverwrites.edit(roleId, VOICE_STAFF_ALLOW, { reason: 'Sincronização de cargos do Rocha Ticket' }).catch(() => null);
      }
    }

    snapshots.set(ticket.uid, [...desired]);
    synced++;
  }

  if (snapshots.size) {
    await mutate(state => {
      for (const [uid, roles] of snapshots) {
        const stored = state.tickets[uid];
        if (stored) stored.syncedStaffRoleIds = roles;
      }
    });
  }

  return synced;
}

async function syncAllGuildPermissions(client) {
  let guilds = 0;
  let tickets = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      tickets += await syncStaffRolePermissions(guild);
      guilds++;
    } catch (error) {
      console.error(`Falha ao sincronizar permissões em ${guild.id}:`, error);
    }
  }
  return { guilds, tickets };
}

module.exports = { syncStaffRolePermissions, syncAllGuildPermissions };
