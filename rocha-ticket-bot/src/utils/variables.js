const { safeChannelName, slugify } = require('./ids');

const VARIABLE_DOCS = {
  '{guilda}': 'Nome do servidor',
  '{guild_id}': 'ID do servidor',
  '{user_name}': 'Nome do usuário',
  '{user_display}': 'Nome de exibição no servidor',
  '{user_id}': 'ID do usuário',
  '{user_mention}': 'Menção do usuário',
  '{ticket_id}': 'Número do ticket',
  '{ticket_uid}': 'ID interno do ticket',
  '{ticket_type}': 'Nome do tipo/categoria de ticket',
  '{ticket_type_id}': 'ID interno do tipo de ticket',
  '{ticket_type_slug}': 'Nome normalizado do tipo de ticket',
  '{ticket_name}': 'Nome atual do canal do ticket',
  '{channel_id}': 'ID do canal',
  '{channel_mention}': 'Menção do canal',
  '{staff_name}': 'Nome do atendente',
  '{staff_display}': 'Nome de exibição do atendente',
  '{staff_id}': 'ID do atendente',
  '{staff_mention}': 'Menção do atendente',
  '{reason}': 'Motivo/resultado do fechamento',
  '{rating}': 'Nota da avaliação',
  '{rating_comment}': 'Comentário da avaliação',
  '{created_at}': 'Data/hora de abertura',
  '{closed_at}': 'Data/hora de fechamento',
  '{logo}': 'Emoji/logo configurado',
  '{panel_title}': 'Título configurado do painel'
};

function buildVariables({ guild, member, user, ticket, ticketType, channel, staff, reason, rating, ratingComment, config }) {
  const actor = user || member?.user;
  const staffUser = staff?.user || staff;
  const actorId = actor?.id || ticket?.userId || '';
  const staffId = staffUser?.id || ticket?.claimedBy || '';

  return {
    guilda: guild?.name || '',
    guild_id: guild?.id || ticket?.guildId || '',
    user_name: actor?.username || ticket?.userName || '',
    user_display: member?.displayName || actor?.globalName || actor?.username || ticket?.userDisplay || ticket?.userName || '',
    user_id: actorId,
    user_mention: actorId ? `<@${actorId}>` : '',
    ticket_id: ticket?.number != null ? String(ticket.number).padStart(4, '0') : '',
    ticket_uid: ticket?.uid || '',
    ticket_type: ticketType?.name || ticket?.typeName || '',
    ticket_type_id: ticketType?.id || ticket?.typeId || '',
    ticket_type_slug: slugify(ticketType?.name || ticket?.typeName || ''),
    ticket_name: channel?.name || ticket?.channelName || '',
    channel_id: channel?.id || ticket?.channelId || '',
    channel_mention: (channel?.id || ticket?.channelId) ? `<#${channel?.id || ticket.channelId}>` : '',
    staff_name: staffUser?.username || ticket?.claimedByName || '',
    staff_display: staff?.displayName || staffUser?.globalName || staffUser?.username || ticket?.claimedByDisplay || ticket?.claimedByName || '',
    staff_id: staffId,
    staff_mention: staffId ? `<@${staffId}>` : '',
    reason: reason || ticket?.closeReason || '',
    rating: rating != null ? String(rating) : '',
    rating_comment: ratingComment || '',
    created_at: ticket?.createdAt ? new Date(ticket.createdAt).toLocaleString('pt-BR') : '',
    closed_at: ticket?.closedAt ? new Date(ticket.closedAt).toLocaleString('pt-BR') : '',
    logo: config?.branding?.logoEmoji || ':rocha:',
    panel_title: config?.branding?.title || 'Ticket | Rocha Roleplay'
  };
}

function renderTemplate(template, vars = {}) {
  let out = String(template ?? '');
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, value == null ? '' : String(value));
  }
  return out;
}

function renderChannelName(template, vars = {}) {
  return safeChannelName(renderTemplate(template, vars));
}

module.exports = { VARIABLE_DOCS, buildVariables, renderTemplate, renderChannelName };
