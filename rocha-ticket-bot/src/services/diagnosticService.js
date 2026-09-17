const fs = require('node:fs/promises');
const path = require('node:path');
const { GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { DB_PATH, getGuildConfig, getState } = require('../database/store');
const { validateConfiguration } = require('./configService');
const { panelMessage } = require('../panels/ticketPanel');
const views = require('../panels/configPanel');

function collectCustomIds(payload) {
  const ids = [];
  for (const row of payload?.components || []) {
    const rowJson = typeof row.toJSON === 'function' ? row.toJSON() : row;
    for (const component of rowJson.components || []) {
      if (component.custom_id) ids.push(component.custom_id);
    }
  }
  return ids;
}

function duplicatedCustomIds(payload) {
  const seen = new Set();
  const duplicates = new Set();
  for (const id of collectCustomIds(payload)) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

async function databaseStats() {
  let bytes = 0;
  let backups = 0;
  try {
    const stat = await fs.stat(DB_PATH);
    bytes = stat.size;
  } catch {}
  try {
    const backupDir = path.join(path.dirname(DB_PATH), 'backups');
    const files = await fs.readdir(backupDir);
    backups = files.filter(name => name.endsWith('.json')).length;
  } catch {}
  return { bytes, backups };
}

async function runDiagnostics(guild, client) {
  const config = await getGuildConfig(guild.id);
  const db = await getState();
  const validation = await validateConfiguration(guild, config);
  const errors = [];
  const warnings = [...validation.warnings];
  const ok = [];

  if (validation.missing.length) errors.push(...validation.missing);
  else ok.push('Configuração obrigatória válida.');

  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  const requiredPermissions = [
    ['ViewChannel', PermissionFlagsBits.ViewChannel],
    ['SendMessages', PermissionFlagsBits.SendMessages],
    ['ReadMessageHistory', PermissionFlagsBits.ReadMessageHistory],
    ['EmbedLinks', PermissionFlagsBits.EmbedLinks],
    ['AttachFiles', PermissionFlagsBits.AttachFiles],
    ['ManageChannels', PermissionFlagsBits.ManageChannels],
    ['ManageRoles', PermissionFlagsBits.ManageRoles]
  ];
  if (!me) {
    errors.push('Não consegui localizar o próprio bot como membro do servidor.');
  } else {
    const missingPerms = requiredPermissions.filter(([, bit]) => !me.permissions.has(bit)).map(([name]) => name);
    if (missingPerms.length) errors.push(`Permissões ausentes no bot: ${missingPerms.join(', ')}.`);
    else ok.push('Permissões principais do bot presentes.');
  }

  if (!client.options.intents.has(GatewayIntentBits.MessageContent)) {
    warnings.push('MessageContent Intent não está carregado; transcripts podem sair sem texto.');
  } else {
    ok.push('MessageContent Intent carregado no cliente.');
  }

  const panelChannel = config.panel.channelId
    ? (guild.channels.cache.get(config.panel.channelId) || await guild.channels.fetch(config.panel.channelId).catch(() => null))
    : null;
  if (config.panel.channelId && !panelChannel) errors.push('Canal configurado do painel não existe.');
  if (panelChannel && config.panel.messageId) {
    const message = panelChannel.isTextBased()
      ? await panelChannel.messages.fetch(config.panel.messageId).catch(() => null)
      : null;
    if (!message) warnings.push('A mensagem publicada do painel não existe mais; execute `/painel` para recriar.');
    else ok.push('Mensagem publicada do painel localizada.');
  }

  const panelDuplicates = duplicatedCustomIds(panelMessage(config, guild));
  if (panelDuplicates.length) errors.push(`Painel público possui custom_id duplicado: ${panelDuplicates.join(', ')}`);
  else ok.push('Painel público sem custom_id duplicado.');

  const validationView = { ok: validation.ok, missing: validation.missing, warnings: validation.warnings };
  const viewPayloads = [
    ['configHome', views.configHome(config, validationView)],
    ['permissionsPanel', views.permissionsPanel(config)],
    ['panelSettings', views.panelSettings(config)],
    ['selectorsPanel', views.selectorsPanel(config)],
    ['ticketTypesPanel', views.ticketTypesPanel(config, 0)],
    ['questionnairePanel', views.questionnairePanel(config)],
    ['logsPanel', views.logsPanel(config)],
    ['ratingPanel', views.ratingPanel(config)],
    ['templatesPanel', views.templatesPanel(config)],
    ['presetsPanel', views.presetsPanel(config)],
    ['securityPanel', views.securityPanel(config)]
  ];
  for (const [name, payload] of viewPayloads) {
    const duplicates = duplicatedCustomIds(payload);
    if (duplicates.length) errors.push(`${name} possui custom_id duplicado: ${duplicates.join(', ')}`);
  }
  if (!errors.some(x => x.includes('custom_id duplicado'))) ok.push('Painéis de configuração sem custom_id duplicado.');

  const guildTickets = Object.values(db.tickets).filter(ticket => ticket.guildId === guild.id);
  const active = guildTickets.filter(ticket => ['creating', 'open', 'closing'].includes(ticket.status));
  const closed = guildTickets.filter(ticket => ticket.status === 'closed');
  const orphaned = guildTickets.filter(ticket => ticket.status === 'orphaned');
  const numbers = new Map();
  for (const ticket of guildTickets) {
    const key = String(ticket.number);
    numbers.set(key, (numbers.get(key) || 0) + 1);
  }
  const duplicatedNumbers = [...numbers.entries()].filter(([, count]) => count > 1).map(([number]) => number);
  if (duplicatedNumbers.length) warnings.push(`IDs numéricos repetidos no histórico: ${duplicatedNumbers.slice(0, 20).join(', ')}.`);
  else ok.push('Nenhum ID numérico repetido detectado no histórico.');

  let missingTicketChannels = 0;
  let stuckClosing = 0;
  let missingCalls = 0;
  for (const ticket of active) {
    if (ticket.status === 'closing') stuckClosing++;
    const channel = ticket.channelId
      ? (guild.channels.cache.get(ticket.channelId) || await guild.channels.fetch(ticket.channelId).catch(() => null))
      : null;
    if (!channel) missingTicketChannels++;
    if (ticket.callChannelId) {
      const call = guild.channels.cache.get(ticket.callChannelId) || await guild.channels.fetch(ticket.callChannelId).catch(() => null);
      if (!call) missingCalls++;
    }
  }
  if (missingTicketChannels) errors.push(`${missingTicketChannels} ticket(s) ativo(s) estão sem canal.`);
  else ok.push('Todos os tickets ativos possuem canal válido.');
  if (stuckClosing) warnings.push(`${stuckClosing} ticket(s) estão no estado closing; reiniciar o bot executa a recuperação automática.`);
  if (missingCalls) warnings.push(`${missingCalls} ticket(s) apontam para calls inexistentes.`);
  if (orphaned.length) warnings.push(`${orphaned.length} ticket(s) órfão(s) estão preservados no histórico.`);

  const counter = Number(db.counters[guild.id] || config.ticket.counterStart || 1);
  const highest = guildTickets.reduce((max, ticket) => Math.max(max, Number(ticket.number) || 0), 0);
  if (counter <= highest) errors.push(`Contador atual (${counter}) não está acima do maior ticket (${highest}).`);
  else ok.push(`Contador consistente: próximo ${counter}, maior usado ${highest}.`);

  const questionnaireResponses = Object.values(db.questionnaireResponses).filter(response => response.guildId === guild.id);
  const pendingQuestionnaires = Object.values(db.pendingQuestionnaires).filter(response => response.guildId === guild.id);
  const ratings = Object.values(db.ratings).filter(rating => rating.guildId === guild.id);
  const pendingRatings = ratings.filter(rating => !rating.answeredAt);
  const expiredCooldowns = Object.entries(db.cooldowns || {}).filter(([key, expiresAt]) => key.startsWith(`${guild.id}:`) && Number(expiresAt) <= Date.now()).length;
  if (expiredCooldowns) warnings.push(`${expiredCooldowns} cooldown(s) expirado(s) aguardam a próxima limpeza automática.`);

  const storage = await databaseStats();
  if (!storage.backups) warnings.push('Ainda não há backup automático JSON em data/backups.');
  else ok.push(`${storage.backups} backup(s) automático(s) disponível(is).`);

  return {
    config,
    validation,
    errors,
    warnings,
    ok,
    stats: {
      totalTickets: guildTickets.length,
      activeTickets: active.length,
      closedTickets: closed.length,
      orphanedTickets: orphaned.length,
      questionnaireResponses: questionnaireResponses.length,
      pendingQuestionnaires: pendingQuestionnaires.length,
      ratings: ratings.length,
      pendingRatings: pendingRatings.length,
      databaseBytes: storage.bytes,
      backups: storage.backups
    }
  };
}

module.exports = { collectCustomIds, duplicatedCustomIds, databaseStats, runDiagnostics };
