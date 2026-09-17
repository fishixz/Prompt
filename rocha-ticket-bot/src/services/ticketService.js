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

async function nextTicketNumber(guildId, start = 1) {
  return mutate(db => {
    if (db.counters[guildId] == null) db.counters[guildId] = Number(start) || 1;
    const current = db.counters[guildId];
    db.counters[guildId] = current + 1;
    return current;
  });
}

async function findOpenTickets(guildId, userId) {
  const db = await getState();
  return Object.values(db.tickets).filter(t => t.guildId === guildId && t.userId === userId && ['open', 'closing'].includes(t.status));
}

async function getTicketByUid(uid) {
  const db = await getState();
  return db.tickets[uid] || null;
}

async function getTicketByChannel(channelId) {
  const db = await getState();
  return Object.values(db.tickets).find(t => t.channelId === channelId && ['open', 'closing'].includes(t.status)) || null;
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

async function createTicket(guild, user, typeId) {
  const config = await getGuildConfig(guild.id);
  const type = getTicketType(config, typeId);
  if (!type || !type.enabled) throw new Error('Esse tipo de ticket não existe ou está desativado.');

  if (config.security.preventBotsOpeningTickets && user.bot) throw new Error('Bots não podem abrir tickets.');
  const currentOpen = await findOpenTickets(guild.id, user.id);
  const max = config.ticket.oneOpenPerUser ? 1 : Math.max(1, Number(config.ticket.maxActiveTicketsPerUser) || 1);
  if (currentOpen.length >= max) {
    const existing = currentOpen[0];
    const err = new Error(`Você já possui um ticket aberto: <#${existing.channelId}>`);
    err.code = 'OPEN_TICKET';
    err.ticket = existing;
    throw err;
  }

  const number = await nextTicketNumber(guild.id, config.ticket.counterStart);
  const uid = shortId('t_');
  const member = await guild.members.fetch(user.id).catch(() => null);
  const tempTicket = { uid, number, guildId: guild.id, userId: user.id, typeId, typeName: type.name, createdAt: new Date().toISOString() };
  const vars = buildVariables({ guild, member, user, ticket: tempTicket, ticketType: type, config });
  const channelName = renderChannelName(type.channelNameTemplate || config.ticket.defaultNameTemplate, vars);
  const roleIds = [...(config.permissions.staffRoleIds || []), ...(type.staffRoleIds || [])];

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: type.parentCategoryId || undefined,
    topic: renderTemplate(config.ticket.topicTemplate, { ...vars, ticket_name: channelName }),
    permissionOverwrites: permissionOverwrites(guild, user.id, guild.members.me.id, roleIds),
    reason: `Ticket #${String(number).padStart(4, '0')} aberto por ${user.tag}`
  });

  const ticket = {
    ...tempTicket,
    channelId: channel.id,
    channelName: channel.name,
    status: 'open',
    selectorId: type.selectorId,
    claimedBy: null,
    addedMembers: [],
    notes: [],
    callChannelId: null,
    userLeftAt: null,
    closeReason: null,
    closedAt: null,
    deleteAt: null
  };
  await mutate(db => { db.tickets[uid] = ticket; });

  const messages = ticketOpeningMessages(config, ticket, type, channel, user);
  for (const payload of messages) await channel.send(payload);
  await sendLog(guild, 'ticket_open', {
    ticket,
    ticketType: type,
    title: '🎫 Ticket aberto',
    description: `**Usuário:** ${user} (\`${user.id}\`)\n**Tipo:** ${type.name}\n**Canal:** ${channel}\n**ID:** \`${String(number).padStart(4, '0')}\``
  });
  return { ticket, type, channel };
}

async function updateTicket(uid, patch) {
  return mutate(db => {
    const t = db.tickets[uid];
    if (!t) return null;
    Object.assign(t, typeof patch === 'function' ? patch(t) : patch);
    return t;
  });
}

async function setClaimed(uid, userId) {
  return updateTicket(uid, { claimedBy: userId, claimedAt: new Date().toISOString() });
}

async function markUserExited(uid) {
  return updateTicket(uid, { userLeftAt: new Date().toISOString() });
}

async function addTicketMember(uid, userId) {
  return updateTicket(uid, t => ({ addedMembers: [...new Set([...(t.addedMembers || []), userId])] }));
}

async function removeTicketMember(uid, userId) {
  return updateTicket(uid, t => ({ addedMembers: (t.addedMembers || []).filter(id => id !== userId) }));
}

async function addInternalNote(uid, note, staffId) {
  return updateTicket(uid, t => ({ notes: [...(t.notes || []), { note, staffId, createdAt: new Date().toISOString() }] }));
}

async function markClosing(uid, reason, staffId) {
  return updateTicket(uid, {
    status: 'closing',
    closeReason: reason,
    closedBy: staffId,
    closedAt: new Date().toISOString()
  });
}

async function markClosed(uid, deleteAt = null) {
  return updateTicket(uid, { status: 'closed', deleteAt });
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
      const vc = guild.channels.cache.get(ticket.callChannelId) || await guild.channels.fetch(ticket.callChannelId).catch(() => null);
      if (vc) await vc.delete('Limpeza automática da call do ticket').catch(() => null);
    }
    await updateTicket(ticket.uid, { deleteAt: null });
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
  markClosed,
  dueTicketCleanup
};
