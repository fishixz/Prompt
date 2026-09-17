const { AttachmentBuilder } = require('discord.js');

function escapeHtml(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function nl2br(input) {
  return escapeHtml(input).replaceAll('\n', '<br>');
}

async function fetchAllMessages(channel, limit = 5000) {
  const all = [];
  let before;
  while (all.length < limit) {
    const batch = await channel.messages.fetch({ limit: Math.min(100, limit - all.length), before }).catch(() => null);
    if (!batch?.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function renderEmbed(embed) {
  const parts = [];
  if (embed.author?.name) parts.push(`<div class="embed-author">${escapeHtml(embed.author.name)}</div>`);
  if (embed.title) parts.push(`<div class="embed-title">${escapeHtml(embed.title)}</div>`);
  if (embed.description) parts.push(`<div class="embed-description">${nl2br(embed.description)}</div>`);
  if (embed.fields?.length) {
    parts.push(`<div class="embed-fields">${embed.fields.map(field => `<div class="embed-field"><b>${escapeHtml(field.name)}</b><div>${nl2br(field.value)}</div></div>`).join('')}</div>`);
  }
  if (embed.image?.url) parts.push(`<div class="embed-media"><a href="${escapeHtml(embed.image.url)}">Imagem da embed</a></div>`);
  if (embed.thumbnail?.url) parts.push(`<div class="embed-media"><a href="${escapeHtml(embed.thumbnail.url)}">Thumbnail</a></div>`);
  if (embed.footer?.text) parts.push(`<div class="embed-footer">${escapeHtml(embed.footer.text)}</div>`);
  return `<div class="embed">${parts.join('')}</div>`;
}

function renderAttachments(message) {
  if (!message.attachments?.size) return '';
  return `<div class="attachments">${[...message.attachments.values()].map(attachment => {
    const name = escapeHtml(attachment.name || 'anexo');
    const url = escapeHtml(attachment.url);
    const image = attachment.contentType?.startsWith('image/') ? `<div><img class="attachment-image" src="${url}" alt="${name}"></div>` : '';
    return `<div class="attachment"><a href="${url}">${name}</a>${image}</div>`;
  }).join('')}</div>`;
}

function renderStickers(message) {
  if (!message.stickers?.size) return '';
  return `<div class="meta">Stickers: ${[...message.stickers.values()].map(sticker => escapeHtml(sticker.name)).join(', ')}</div>`;
}

function renderReactions(message) {
  if (!message.reactions?.cache?.size) return '';
  const reactions = [...message.reactions.cache.values()]
    .map(reaction => `${escapeHtml(reaction.emoji?.name || 'emoji')} × ${reaction.count || 0}`)
    .join(' · ');
  return reactions ? `<div class="reactions">${reactions}</div>` : '';
}

function renderReply(message, byId) {
  const referenceId = message.reference?.messageId;
  if (!referenceId) return '';
  const referenced = byId.get(referenceId);
  if (!referenced) return `<div class="reply">↪ Resposta a uma mensagem anterior (${escapeHtml(referenceId)})</div>`;
  const author = referenced.author?.tag || referenced.author?.username || 'Desconhecido';
  const excerpt = String(referenced.cleanContent || referenced.content || '[sem texto]').slice(0, 180);
  return `<div class="reply">↪ <b>${escapeHtml(author)}</b>: ${escapeHtml(excerpt)}</div>`;
}

async function buildTranscript(channel, ticket) {
  const messages = await fetchAllMessages(channel);
  const byId = new Map(messages.map(message => [message.id, message]));

  const rows = messages.map(message => {
    const author = escapeHtml(message.author?.tag || message.author?.username || 'Desconhecido');
    const avatar = message.author?.displayAvatarURL?.({ extension: 'png', size: 64 }) || '';
    const time = new Date(message.createdTimestamp).toLocaleString('pt-BR');
    const edited = message.editedTimestamp ? ' • editada' : '';
    const content = nl2br(message.cleanContent || message.content || '');
    const embeds = (message.embeds || []).map(renderEmbed).join('');
    const attachments = renderAttachments(message);
    const stickers = renderStickers(message);
    const reactions = renderReactions(message);
    const reply = renderReply(message, byId);
    const body = content || (!embeds && !attachments && !stickers ? '<i>[sem texto]</i>' : '');

    return `<article class="msg">
      <img class="avatar" src="${escapeHtml(avatar)}" alt="">
      <div>
        <div class="head"><b>${author}</b><span>${escapeHtml(time)}${edited}</span></div>
        ${reply}
        <div class="content">${body}</div>
        ${attachments}
        ${embeds}
        ${stickers}
        ${reactions}
      </div>
    </article>`;
  }).join('\n');

  const notesCount = Array.isArray(ticket?.notes) ? ticket.notes.length : 0;
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcript Ticket ${escapeHtml(ticket?.number)}</title>
<style>
body{font-family:Arial,sans-serif;background:#111318;color:#eee;margin:0;padding:24px}.wrap{max-width:1000px;margin:auto}.top{background:#1d2027;border:1px solid #343842;padding:18px;border-radius:12px;margin-bottom:18px}.top h2{margin-top:0}.msg{display:grid;grid-template-columns:44px 1fr;gap:12px;padding:14px 0;border-bottom:1px solid #2b2e36}.avatar{width:44px;height:44px;border-radius:50%;object-fit:cover}.head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.head span,.meta,.embed-footer{color:#969aa5;font-size:12px}.content{margin-top:5px;line-height:1.45;word-break:break-word}.attachments{margin-top:8px}.attachment{margin:5px 0}.attachments a,.embed-media a{color:#f5a300}.attachment-image{max-width:420px;max-height:320px;border-radius:8px;margin-top:6px}.embed{border-left:4px solid #f5a300;background:#181b21;padding:10px 12px;margin-top:8px;border-radius:4px}.embed-title{font-weight:700;margin-bottom:5px}.embed-author,.embed-footer{margin-bottom:5px}.embed-fields{display:grid;gap:8px;margin-top:8px}.embed-field{background:#20242b;padding:7px;border-radius:5px}.reply{border-left:3px solid #565b66;color:#b9bdc6;padding:4px 8px;margin:5px 0;font-size:13px}.reactions{display:flex;gap:6px;flex-wrap:wrap;color:#c6cad2;font-size:13px;margin-top:8px}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <h2>Rocha Roleplay • Ticket #${escapeHtml(String(ticket?.number ?? '').padStart(4,'0'))}</h2>
    <div><b>Canal:</b> ${escapeHtml(channel.name)} • <b>ID:</b> ${escapeHtml(channel.id)}</div>
    <div><b>Tipo:</b> ${escapeHtml(ticket?.typeName || ticket?.typeId || '')}</div>
    <div><b>Usuário:</b> ${escapeHtml(ticket?.userName || ticket?.userId || '')}</div>
    <div><b>Atendente:</b> ${escapeHtml(ticket?.claimedByName || ticket?.claimedBy || 'não assumido')}</div>
    <div><b>Motivo de fechamento:</b> ${escapeHtml(ticket?.closeReason || 'não informado')}</div>
    <div><b>Observações internas registradas:</b> ${notesCount}</div>
    <div><b>Mensagens exportadas:</b> ${messages.length}</div>
  </div>
  ${rows || '<p>Nenhuma mensagem encontrada.</p>'}
</div>
</body>
</html>`;

  const name = `transcript-ticket-${String(ticket?.number ?? '0').padStart(4, '0')}.html`;
  const buffer = Buffer.from(html, 'utf8');
  return {
    name,
    buffer,
    attachment: new AttachmentBuilder(buffer, { name })
  };
}

module.exports = { buildTranscript, fetchAllMessages };
