const { AttachmentBuilder } = require('discord.js');

function escapeHtml(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function fetchAllMessages(channel, limit = 3000) {
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

async function buildTranscript(channel, ticket) {
  const messages = await fetchAllMessages(channel);
  const rows = messages.map(msg => {
    const author = escapeHtml(msg.author?.tag || msg.author?.username || 'Desconhecido');
    const avatar = msg.author?.displayAvatarURL?.({ extension: 'png', size: 64 }) || '';
    const time = new Date(msg.createdTimestamp).toLocaleString('pt-BR');
    const content = escapeHtml(msg.cleanContent || msg.content || '').replaceAll('\n', '<br>');
    const attachments = [...msg.attachments.values()].map(a => `<a href="${escapeHtml(a.url)}">${escapeHtml(a.name || 'anexo')}</a>`).join(' · ');
    const embeds = msg.embeds?.length ? `<div class="meta">${msg.embeds.length} embed(s)</div>` : '';
    return `<article class="msg"><img src="${escapeHtml(avatar)}"><div><div class="head"><b>${author}</b><span>${escapeHtml(time)}</span></div><div class="content">${content || '<i>[sem texto]</i>'}</div>${attachments ? `<div class="attachments">${attachments}</div>` : ''}${embeds}</div></article>`;
  }).join('\n');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Transcript Ticket ${escapeHtml(ticket?.number)}</title><style>body{font-family:Arial,sans-serif;background:#111318;color:#eee;margin:0;padding:24px}.wrap{max-width:1000px;margin:auto}.top{background:#1d2027;border:1px solid #343842;padding:18px;border-radius:12px;margin-bottom:18px}.msg{display:grid;grid-template-columns:44px 1fr;gap:12px;padding:14px 0;border-bottom:1px solid #2b2e36}.msg img{width:44px;height:44px;border-radius:50%}.head{display:flex;gap:10px;align-items:center}.head span,.meta{color:#969aa5;font-size:12px}.content{margin-top:5px;line-height:1.45;word-break:break-word}.attachments{margin-top:6px}.attachments a{color:#f5a300}</style></head><body><div class="wrap"><div class="top"><h2>Rocha Roleplay • Ticket #${escapeHtml(String(ticket?.number ?? '').padStart(4,'0'))}</h2><div>Canal: ${escapeHtml(channel.name)} • ID: ${escapeHtml(channel.id)}</div><div>Mensagens exportadas: ${messages.length}</div></div>${rows || '<p>Nenhuma mensagem encontrada.</p>'}</div></body></html>`;

  const name = `transcript-ticket-${String(ticket?.number ?? '0').padStart(4, '0')}.html`;
  return {
    name,
    buffer: Buffer.from(html, 'utf8'),
    attachment: new AttachmentBuilder(Buffer.from(html, 'utf8'), { name })
  };
}

module.exports = { buildTranscript };
