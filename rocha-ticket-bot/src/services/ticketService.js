const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const { getGuildConfig, getState, mutate } = require('../database/store');
const { getTicketType } = require('./configService');
const { shortId } = require('../utils/ids');
const { buildVariables, renderChannelName, renderTemplate } = require('../utils/variables');
const { ticketOpeningMessages } = require('../panels/ticketPanel');
const { sendLog } = require('./logService');

const creationLocks = new Set();

function creationLockKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

async function nextTicketNumber(guildId, start = 1) {
  return mutate(db => {
    const configuredStart = Math.max(1, Number(start) || 1);
    const highestExisting = Object.values(db.tickets)
      .filter(t => t.guildId === guildId && Number.isFinite(Number(t.number)))
      .reduce((max, t) => Math.max(max, Number(t.number)), 0);
    const minimumNext = Math.max(configuredStart, highestExisting + 1);
    if (db.counters[guildId] == null || Number(db.counters[guildId]) < minimumNext) {
      db.counters[guildId] = minimumNext;
    }
    const current = Number(db.counters[guildId]);
    db.counters[guildId] = current + 1;
    return current;
  });
}

async function findOpenTickets(guildId, userId) {
  const db = await getState();
  return Object.values(db.tickets).filter(t =>
    t.guildId === guildId &&
    t.userId === userId &&
    ['creating', 'open', 'closing'].includes(t.status)
  );
}

async function getTicketByUid(uid) {
  const db = await getState();
  return db.tickets[uid] || null;
}

async function getTicketByChannel(channelId) {
  const db = await getState();
  return Object.values(db.tickets).find(t =>
    t.channelId === channelId && ['creating', 'open', 'closing'].includes(t.status)
  ) || null;
}

function permissionOverwrites(guild, userId, botId, roleIds) {
  const allow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AddReactions
  ];
  const staffAllow = [...allow, PermissionFlagsBits.ManageMessages];
  const list = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: userId, allow },
    { id: botId, allow: [...staffAllow, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] }
  ];
  for (const roleId of new Set(roleIds.filter(Boolean))) list.push({ id: roleId, allow: staffAllow });
  return list;
}

async function updateTicket(uid, patch) {
  return mutate(db => {
    const ticket = db.tickets[uid];
    if (!ticket) return null;
    Object.assign(ticket, typeof patch === 'function' ? patch(ticket) : patch);
    return ticket;
  });
}

async function markOrphaned(uid, reason = 'Canal do ticket não existe mais.') {
  return updateTicket(uid, {
    status: 'orphaned',
    closeReason: reason,
    closedAt: new Date().toISOString(),
    deleteAt: null
  });
}

async function pruneMissingOpenTickets(guild, userId = null) {
  const db = await getState();
  const candidates = Object.values(db.tickets).filter(ticket =>
    ticket.guildId === guild.id &&
    (!userId || ticket.userId === userId) &&
    ['creating', 'open', 'closing'].includes(ticket.status)
  );

  for (const ticket of candidates) {
    if (!ticket.channelId) {
      const age = Date.now() - new Date(ticket.createdAt || 0).getTime();
      if (ticket.status !== 'creating' || age > 120_000) {
        await markOrphaned(ticket.uid, 'Criação interrompida antes de gerar o canal.');
      }
      continue;
    }
    const channel = guild.channels.cache.get(ticket.channelId)
      || await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel) await markOrphaned(ticket.uid, 'Canal do ticket foi removido manualmente ou não existe mais.');
  }
}

async function createTicket(guild, user, typeId) {
  const lockKey = creationLockKey(guild.id, user.id);
  if (creationLocks.has(lockKey)) {
    const error = new Error('Já existe uma criação de ticket em andamento para você. Aguarde alguns segundos.');
    error.code = 'TICKET_CREATING';
    throw error;
  }

  creationLocks.add(lockKey);
  try {
    const config = await getGuildConfig(guild.id);
    const type = getTicketType(config, typeId);
    if (!type || !type.enabled) throw new Error('Esse tipo de ticket não existe ou está desativado.');
    if (config.security.preventBotsOpeningTickets && user.bot) throw new Error('Bots não podem abrir tickets.');

    await pruneMissingOpenTickets(guild, user.id);

    const currentOpen = await findOpenTickets(guild.id, user.id);
    const max = config.ticket.oneOpenPerUser ? 1 : Math.max(1, Number(config.ticket.maxActiveTicketsPerUser) || 1);
    if (currentOpen.length >= max) {
      const existing = currentOpen[0];
      const error = new Error(existing.channelId
        ? `Você já possui um ticket aberto: <#${existing.channelId}>`
        : 'Você já possui um ticket em processo de abertura.');
      error.code = 'OPEN_TICKET';
      error.ticket = existing;
      throw error;
    }

    const number = await nextTicketNumber(guild.id, config.ticket.counterStart);
    const uid = shortId('t_');
    const member = await guild.members.fetch(user.id).catch(() => null);
    const tempTicket = {
      uid,
      number,
      guildId: guild.id,
      userId: user.id,
      userName: user.username || '',
      userDisplay: member?.displayName || user.globalName || user.username || '',
      typeId,
      typeName: type.name,
      status: 'creating',
      channelId: null,
      createdAt: new Date().toISOString()
    };

    await mutate(db => { db.tickets[uid] = tempTicket; });

    const vars = buildVariables({ guild, member, user, ticket: tempTicket, ticketType: type, config });
    const channelName = renderChannelName(type.channelNameTemplate || config.ticket.defaultNameTemplate, vars);
    const roleIds = [...new Set([...(config.permissions.staffRoleIds || []), ...(type.staffRoleIds || [])])];

    let channel;
    try {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: type.parentCategoryId || undefined,
        topic: renderTemplate(config.ticket.topicTemplate, { ...vars, ticket_name: channelName }),
        permissionOverwrites: permissionOverwrites(guild, user.id, guild.members.me.id, roleIds),
        reason: `Ticket #${String(number).padStart(4, '0')} aberto por ${user.tag}`
      });
    } catch (error) {
      await markOrphaned(uid, `Falha ao criar canal: ${error.message}`);
      throw error;
    }

    const ticket = {
      ...tempTicket,
      channelId: channel.id,
      channelName: channel.name,
      status: 'open',
      selectorId: type.selectorId,
      claimedBy: null,
      claimedByName: null,
      claimedByDisplay: null,
      claimedAt: null,
      addedMembers: [],
      notes: [],
      callChannelId: null,
      syncedStaffRoleIds: roleIds,
      userLeftAt: null,
      closeReason: null,
      closedAt: null,
      closedBy: null,
      deleteAt: null
    };
    await mutate(db => { db.tickets[uid] = ticket; });

    const messages = ticketOpeningMessages(config, ticket, type, channel, user);
    for (const payload of messages) {
      await channel.send(payload).catch(error => console.error(`Falha ao enviar mensagem inicial do ticket ${uid}:`, error));
    }

    await sendLog(guild, 'ticket_open', {
      ticket,
      ticketType: type,
      title: '🎫 Ticket aberto',
      description: `**Usuário:** ${user} (\`${user.id}\`)\n**Tipo:** ${type.name}\n**Canal:** ${channel}\n**ID:** \`${String(number).padStart(4, '0')}\``
    });
    return { ticket, type, channel };
  } finally {
    creationLocks.delete(lockKey);
  }
}

async function setClaimed(uid, userOrId) {
  const user = userOrId?.user || (typeof userOrId === 'object' ? userOrId : null);
  const userId = typeof userOrId === 'string' ? userOrId : user?.id;
  if (!userId) return null;
  return updateTicket(uid, {
    claimedBy: userId,
    claimedByName: user?.username || null,
    claimedByDisplay: userOrId?.displayName || user?.globalName || user?.username || null,
    claimedAt: new Date().toISOString()
  });
}

async function markUserExited(uid) {
  return updateTicket(uid, { userLeftAt: new Date().toISOString() });
}

async function addTicketMember(uid, userId) {
  return updateTicket(uid, ticket => ({ addedMembers: [...new Set([...(ticket.addedMembers || []), userId])] }));
}

async function removeTicketMember(uid, userId) {
  return updateTicket(uid, ticket => ({ addedMembers: (ticket.addedMembers || []).filter(id => id !== userId) }));
}

async function addInternalNote(uid, note, staffId) {
  return updateTicket(uid, ticket => ({ notes: [...(ticket.notes || []), { note, staffId, createdAt: new Date().toISOString() }] }));
}

async function markClosing(uid, reason, staffId) {
  return updateTicket(uid, {
    status: 'closing',
    closeReason: reason,
    closedBy: staffId,
    closingStartedAt: new Date().toISOString()
  });
}

async function rollbackClosing(uid) {
  return updateTicket(uid, {
    status: 'open',
    closeReason: null,
    closedBy: null,
    closingStartedAt: null
  });
}

async function markClosed(uid, deleteAt = null) {
  return updateTicket(uid, {
    status: 'closed',
    closedAt: new Date().toISOString(),
    closingStartedAt: null,
    deleteAt
  });
}

async function syncCallMemberPermission(guild, ticket, userId, canAccess) {
  if (!ticket?.callChannelId) return false;
  const call = guild.channels.cache.get(ticket.callChannelId)
    || await guild.channels.fetch(ticket.callChannelId).catch(() => null);
  if (!call) {
    await updateTicket(ticket.uid, { callChannelId: null });
    return false;
  }

  if (canAccess) {
    await call.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      Stream: true
    }, { reason: 'Sincronização de acesso do ticket' }).catch(() => null);
  } else {
    await call.permissionOverwrites.delete(userId, 'Sincronização de remoção do ticket').catch(async () => {
      await call.permissionOverwrites.edit(userId, { ViewChannel: false, Connect: false }, { reason: 'Sincronização de remoção do ticket' }).catch(() => null);
    });
  }
  return true;
}

async function markChannelDeleted(channelId) {
  const db = await getState();
  const ticket = Object.values(db.tickets).find(t => t.channelId === channelId && ['creating', 'open', 'closing'].includes(t.status));
  if (!ticket) return null;
  return markOrphaned(ticket.uid, 'Canal do ticket foi apagado.');
}

async function reconcileTickets(client) {
  const db = await getState();
  let orphaned = 0;
  let recoveredClosing = 0;
  let missingCalls = 0;

  for (const ticket of Object.values(db.tickets)) {
    const guild = client.guilds.cache.get(ticket.guildId);
    if (!guild) continue;

    if (['creating', 'open', 'closing'].includes(ticket.status)) {
      const channel = ticket.channelId
        ? (guild.channels.cache.get(ticket.channelId) || await guild.channels.fetch(ticket.channelId).catch(() => null))
        : null;

      if (!channel) {
        const age = Date.now() - new Date(ticket.createdAt || 0).getTime();
        if (ticket.status !== 'creating' || age > 120_000) {
          await markOrphaned(ticket.uid, 'Reconciliação: canal do ticket não existe.');
          orphaned++;
          continue;
        }
      }

      if (ticket.status === 'closing') {
        await rollbackClosing(ticket.uid);
        recoveredClosing++;
      }
    }

    if (ticket.callChannelId) {
      const call = guild.channels.cache.get(ticket.callChannelId)
        || await guild.channels.fetch(ticket.callChannelId).catch(() => null);
      if (!call) {
        await updateTicket(ticket.uid, { callChannelId: null });
        missingCalls++;
      }
    }
  }

  return { orphaned, recoveredClosing, missingCalls };
}

async function dueTicketCleanup(client) {
  const db = await getState();
  const now = Date.now();
  for (const ticket of Object.values(db.tickets)) {
    if (ticket.status !== 'closed' || !ticket.deleteAt || new Date(ticket.deleteAt).getTime() > now) continue;
    const guild = client.guilds.cache.get(ticket.guildId);
    if (!guild) continue;
    const channel = guild.channels.cache.get(ticket.channelId) || await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (channel) await channel.delete('Limpeza automática de ticket finalizado').catch(() => null);
    if (ticket.callChannelId) {
      const voice = guild.channels.cache.get(ticket.callChannelId) || await guild.channels.fetch(ticket.callChannelId).catch(() => null);
      if (voice) await voice.delete('Limpeza automática da call do ticket').catch(() => null);
    }
    await updateTicket(ticket.uid, { deleteAt: null, callChannelId: null });
  }
}

module.exports = {
  nextTicketNumber,
  findOpenTickets,
  getTicketByUid,
  getTicketByChannel,
  createTicket,
  updateTicket,
  setClaimed,
  markUserExited,
  addTicketMember,
  removeTicketMember,
  addInternalNote,
  markClosing,
  rollbackClosing,
  markClosed,
  markOrphaned,
  pruneMissingOpenTickets,
  syncCallMemberPermission,
  markChannelDeleted,
  reconcileTickets,
  dueTicketCleanup
};
