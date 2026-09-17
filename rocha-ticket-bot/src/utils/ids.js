const crypto = require('node:crypto');

function shortId(prefix = '') {
  return `${prefix}${crypto.randomBytes(4).toString('hex')}`;
}

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'ticket';
}

function safeChannelName(input) {
  return slugify(input).slice(0, 95);
}

module.exports = { shortId, slugify, safeChannelName };
