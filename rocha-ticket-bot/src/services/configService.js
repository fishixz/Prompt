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

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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

  if (!isHttpUrl(config.panel?.bannerUrl)) missing.push('A **URL do banner** do painel é inválida.');
  if (!/^#[0-9A-Fa-f]{6}$/.test(config.branding?.color || '')) missing.push('A **cor do painel** não está em formato hexadecimal válido.');

  const enabledSelectors = config.panel?.selectors?.filter(s => s.enabled) || [];
  if (!enabledSelectors.length) missing.push('Crie ou ative pelo menos um **seletor** do painel.');

  const selectorIds = new Set();
  for (const selector of config.panel?.selectors || []) {
    if (!selector.id) missing.push('Existe um seletor sem ID interno.');
    if (selectorIds.has(selector.id)) missing.push(`Existe ID de seletor duplicado: \`${selector.id}\`.`);
    selectorIds.add(selector.id);
    if (!selector.placeholder?.trim()) missing.push(`O seletor **${selector.name || selector.id}** não possui placeholder.`);
  }

  const enabledTypes = config.ticketTypes?.filter(t => t.enabled) || [];
  if (!enabledTypes.length) missing.push('Crie e ative pelo menos um **tipo de ticket**.');

  const typeIds = new Set();
  for (const type of config.ticketTypes || []) {
    if (!type.id) missing.push('Existe um tipo de ticket sem ID interno.');
    if (typeIds.has(type.id)) missing.push(`Existe ID de tipo duplicado: \`${type.id}\`.`);
    typeIds.add(type.id);
  }

  for (const type of enabledTypes) {
    if (!type.parentCategoryId) {
      missing.push(`O tipo **${type.name}** não possui categoria do Discord definida.`);
    } else {
      const category = guild.channels.cache.get(type.parentCategoryId);
      if (!category || category.type !== ChannelType.GuildCategory) {
        missing.push(`A categoria configurada em **${type.name}** não existe mais.`);
      }
    }

    if (!type.selectorId || !config.panel.selectors.some(s => s.id === type.selectorId && s.enabled)) {
      missing.push(`O tipo **${type.name}** não está ligado a um seletor ativo.`);
    }

    if (!String(type.channelNameTemplate || '').trim()) {
      missing.push(`O tipo **${type.name}** não possui modelo de nome de canal.`);
    }

    for (const roleId of type.staffRoleIds || []) {
      if (!guild.roles.cache.has(roleId)) warnings.push(`O cargo específico \`${roleId}\` do tipo **${type.name}** não existe mais.`);
    }

    const staffCount = new Set([...(config.permissions?.staffRoleIds || []), ...(type.staffRoleIds || [])]).size;
    if (!staffCount) warnings.push(`O tipo **${type.name}** não possui cargo de staff específico ou global.`);

    for (const channelId of Object.values(type.logChannelIds || {}).filter(Boolean)) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel?.isTextBased()) missing.push(`Um log específico de **${type.name}** aponta para o canal inexistente \`${channelId}\`.`);
    }
  }

  if (config.questionnaire?.enabled && config.questionnaire?.requiredBeforeTicket) {
    if (!config.questionnaire.responseChannelId) {
      missing.push('Configure o **canal de respostas do questionário**.');
    } else {
      const qChannel = guild.channels.cache.get(config.questionnaire.responseChannelId);
      if (!qChannel?.isTextBased()) missing.push('O **canal de respostas do questionário** não existe ou não é de texto.');
    }
    if (!config.questionnaire.questions?.length) {
      missing.push('Adicione pelo menos uma **pergunta ao questionário**, ou desative a obrigatoriedade.');
    }
  }

  for (const question of config.questionnaire?.questions || []) {
    if (!['single', 'text'].includes(question.kind)) missing.push(`A pergunta **${question.text || question.id}** possui tipo inválido.`);
    if (question.kind === 'single' && (question.options || []).length < 2) missing.push(`A pergunta **${question.text || question.id}** precisa de ao menos 2 opções.`);
  }

  if (config.rating?.enabled && !['dm', 'ticket', 'both'].includes(config.rating.mode)) {
    missing.push('Escolha onde o **sistema de avaliação** será enviado.');
  }
  if (config.rating?.enabled) {
    const scale = Number(config.rating.scale) || 5;
    if (scale < 3 || scale > 5) missing.push('A escala de avaliação deve ficar entre **3 e 5**.');
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
  if (totalRows > 5) {
    missing.push(`O painel exigiria **${totalRows} menus**, mas o Discord permite no máximo 5 por mensagem. Separe/desative tipos até caber.`);
  }

  const selectorTypeCounts = new Map();
  for (const type of enabledTypes) {
    selectorTypeCounts.set(type.selectorId, (selectorTypeCounts.get(type.selectorId) || 0) + 1);
  }
  for (const [selectorId, count] of selectorTypeCounts.entries()) {
    if (count > 125) {
      missing.push(`O seletor **${getSelector(config, selectorId)?.name || selectorId}** tem mais de 125 tipos ativos.`);
    }
  }

  if (!String(config.ticket?.defaultNameTemplate || '').trim()) missing.push('Configure o **modelo padrão de nome dos canais**.');
  if (!String(config.ticket?.topicTemplate || '').trim()) warnings.push('O template de tópico do ticket está vazio.');
  if (!String(config.ticket?.callNameTemplate || '').trim()) warnings.push('O template de nome da call está vazio.');

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
