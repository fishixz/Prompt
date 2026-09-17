const { ChannelType } = require('discord.js');
const { getGuildConfig, saveGuildConfig } = require('../database/store');

function getTicketType(config, typeId) {
  return config.ticketTypes?.find(t => t.id === typeId) || null;
}

function getSelector(config, selectorId) {
  return config.panel?.selectors?.find(s => s.id === selectorId) || null;
}

function logChannelFor(config, eventName, ticketType = null) {
  return ticketType?.logChannelIds?.[eventName]
    || ticketType?.logChannelId
    || config.logs?.events?.[eventName]
    || config.logs?.defaultChannelId
    || null;
}

async function validateConfiguration(guild, config = null) {
  config ||= await getGuildConfig(guild.id);
  const missing = [];
  const warnings = [];

  if (!(config.permissions?.adminRoleIds?.length || config.permissions?.adminUserIds?.length)) {
    missing.push('Configure pelo menos um **cargo ou usuário administrador**.');
  }
  for (const roleId of config.permissions?.adminRoleIds || []) {
    if (!guild.roles.cache.has(roleId)) missing.push(`O cargo administrador \`${roleId}\` não existe mais.`);
  }
  for (const roleId of config.permissions?.staffRoleIds || []) {
    if (!guild.roles.cache.has(roleId)) warnings.push(`O cargo global de atendimento \`${roleId}\` não existe mais.`);
  }

  if (!config.panel?.channelId) {
    missing.push('Configure o **canal do painel**.');
  } else {
    const panelChannel = guild.channels.cache.get(config.panel.channelId);
    if (!panelChannel?.isTextBased()) missing.push('O **canal do painel** configurado não existe ou não é de texto.');
  }

  const enabledSelectors = config.panel?.selectors?.filter(s => s.enabled) || [];
  if (!enabledSelectors.length) missing.push('Crie ou ative pelo menos um **seletor** do painel.');

  const enabledTypes = config.ticketTypes?.filter(t => t.enabled) || [];
  if (!enabledTypes.length) missing.push('Crie e ative pelo menos um **tipo de ticket**.');

  for (const type of enabledTypes) {
    if (!type.parentCategoryId) {
      missing.push(`O tipo **${type.name}** não possui categoria do Discord definida.`);
    } else {
      const cat = guild.channels.cache.get(type.parentCategoryId);
      if (!cat || cat.type !== ChannelType.GuildCategory) {
        missing.push(`A categoria configurada em **${type.name}** não existe mais.`);
      }
    }
    if (!type.selectorId || !config.panel.selectors.some(s => s.id === type.selectorId && s.enabled)) {
      missing.push(`O tipo **${type.name}** não está ligado a um seletor ativo.`);
    }
    const staffCount = new Set([...(config.permissions?.staffRoleIds || []), ...(type.staffRoleIds || [])]).size;
    if (!staffCount) warnings.push(`O tipo **${type.name}** não possui cargo de staff específico ou global.`);
  }

  if (config.questionnaire?.enabled && config.questionnaire?.requiredBeforeTicket) {
    if (!config.questionnaire.responseChannelId) missing.push('Configure o **canal de respostas do questionário**.');
    else {
      const qChannel = guild.channels.cache.get(config.questionnaire.responseChannelId);
      if (!qChannel?.isTextBased()) missing.push('O **canal de respostas do questionário** não existe ou não é de texto.');
    }
    if (!config.questionnaire.questions?.length) missing.push('Adicione pelo menos uma **pergunta ao questionário**, ou desative a obrigatoriedade.');
  }

  if (config.rating?.enabled && !['dm', 'ticket', 'both'].includes(config.rating.mode)) {
    missing.push('Escolha onde o **sistema de avaliação** será enviado.');
  }

  const configuredLogIds = new Set([
    config.logs?.defaultChannelId,
    ...Object.values(config.logs?.events || {}),
    config.rating?.logChannelId
  ].filter(Boolean));
  for (const channelId of configuredLogIds) {
    const logChannel = guild.channels.cache.get(channelId);
    if (!logChannel?.isTextBased()) missing.push(`O canal de log \`${channelId}\` não existe ou não é de texto.`);
  }
  if (config.rating?.enabled && !(config.rating?.logChannelId || config.logs?.events?.rating || config.logs?.defaultChannelId)) {
    warnings.push('A avaliação está ativa, mas não há canal de log de avaliação definido.');
  }

  const totalRows = enabledSelectors.reduce((sum, selector) => {
    const count = enabledTypes.filter(t => t.selectorId === selector.id).length;
    return sum + Math.ceil(count / 25);
  }, 0);
  if (totalRows > 5) missing.push(`O painel exigiria **${totalRows} menus**, mas o Discord permite no máximo 5 por mensagem. Separe/desative tipos até caber.`);

  const selectorTypeCounts = new Map();
  for (const type of enabledTypes) selectorTypeCounts.set(type.selectorId, (selectorTypeCounts.get(type.selectorId) || 0) + 1);
  for (const [selectorId, count] of selectorTypeCounts.entries()) {
    if (count > 125) missing.push(`O seletor **${getSelector(config, selectorId)?.name || selectorId}** tem mais de 125 tipos ativos.`);
  }

  return { ok: missing.length === 0, missing, warnings };
}

async function recomputeSetup(guild) {
  const config = await getGuildConfig(guild.id);
  const validation = await validateConfiguration(guild, config);
  config.setupComplete = validation.ok;
  await saveGuildConfig(guild.id, config);
  return { config, validation };
}

module.exports = {
  getTicketType,
  getSelector,
  logChannelFor,
  validateConfiguration,
  recomputeSetup
};
