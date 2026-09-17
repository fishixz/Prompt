const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const {
  getGuildConfig,
  saveGuildConfig,
  backupString,
  getState,
  mutate
} = require('../database/store');
const { shortId, slugify } = require('../utils/ids');
const { truncate } = require('../utils/discord');
const { validateConfiguration, recomputeSetup, getTicketType } = require('../services/configService');
const views = require('../panels/configPanel');
const { panelMessage } = require('../panels/ticketPanel');

const EPHEMERAL = MessageFlags.Ephemeral;

const LOG_EVENTS = [
  ['ticket_open', 'Ticket aberto'],
  ['ticket_claim', 'Atendimento assumido'],
  ['ticket_user_exit', 'Usuário saiu'],
  ['member_add', 'Membro adicionado'],
  ['member_remove', 'Membro removido'],
  ['ticket_move', 'Ticket movido'],
  ['ticket_rename', 'Canal renomeado'],
  ['internal_note', 'Observação interna'],
  ['call_create', 'Call criada'],
  ['greet', 'Saudação'],
  ['ticket_close', 'Ticket finalizado'],
  ['rating', 'Avaliação'],
  ['questionnaire', 'Questionário']
];

const TEMPLATE_LIMITS = {
  createdSuccessTitle: 256,
  createdSuccessBody: 4096,
  ticketOpenTitle: 256,
  ticketOpenBody: 4096,
  userNotice: 4096,
  greetText: 2000,
  closeDmText: 2000,
  closeLogTitle: 256,
  claimText: 2000,
  userExitText: 2000
};

function textInput(id, label, value = '', style = TextInputStyle.Short, required = true, maxLength = 4000) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(truncate(label, 45))
    .setStyle(style)
    .setRequired(required)
    .setMaxLength(maxLength);
  if (value != null && String(value).length) input.setValue(String(value).slice(0, maxLength));
  return new ActionRowBuilder().addComponents(input);
}

function privatePayload(payload) {
  const clean = { ...payload };
  delete clean.ephemeral;
  return { ...clean, flags: EPHEMERAL };
}

async function privateReply(interaction, payload) {
  return interaction.reply(privatePayload(payload));
}

async function updateView(interaction, payload) {
  const clean = { ...payload };
  delete clean.ephemeral;
  delete clean.flags;
  if (interaction.isButton() || interaction.isAnySelectMenu()) return interaction.update(clean);
  return interaction.reply({ ...clean, flags: EPHEMERAL });
}

async function showHome(interaction) {
  const { config, validation } = await recomputeSetup(interaction.guild);
  return updateView(interaction, views.configHome(config, validation));
}

async function showNamed(interaction, name, ...args) {
  const config = await getGuildConfig(interaction.guildId);
  if (name === 'backupPanel') {
    const validation = await validateConfiguration(interaction.guild, config);
    return updateView(interaction, views.backupPanel(config, validation));
  }
  return updateView(interaction, views[name](config, ...args));
}

function brandingModal(config) {
  return new ModalBuilder().setCustomId('config:submit:branding').setTitle('Editar visual do painel').addComponents(
    textInput('color', 'Cor hexadecimal', config.branding.color, TextInputStyle.Short, true, 7),
    textInput('logo', 'Emoji/logo', config.branding.logoEmoji, TextInputStyle.Short, false, 100),
    textInput('title', 'Título', config.branding.title, TextInputStyle.Short, true, 200),
    textInput('banner', 'URL do banner', config.panel.bannerUrl, TextInputStyle.Paragraph, false, 1000),
    textInput('footer', 'Rodapé', config.branding.footer, TextInputStyle.Short, false, 200)
  );
}

function panelDescModal(config) {
  return new ModalBuilder().setCustomId('config:submit:paneldesc').setTitle('Descrição do painel').addComponents(
    textInput('description', 'Descrição completa', config.panel.description, TextInputStyle.Paragraph, true, 4000)
  );
}

function selectorModal(config, selector = null) {
  return new ModalBuilder().setCustomId(`config:submit:selector:${selector?.id || 'new'}`).setTitle(selector ? 'Editar seletor' : 'Novo seletor').addComponents(
    textInput('name', 'Nome interno do seletor', selector?.name || '', TextInputStyle.Short, true, 80),
    textInput('placeholder', 'Texto do menu', selector?.placeholder || 'Clique aqui para selecionar...', TextInputStyle.Short, true, 150),
    textInput('id', 'ID curto (sem espaços)', selector?.id || '', TextInputStyle.Short, false, 40)
  );
}

function ticketTypeModal(config, type = null) {
  return new ModalBuilder().setCustomId(`config:submit:type:${type?.id || 'new'}`).setTitle(type ? 'Editar tipo de ticket' : 'Criar tipo de ticket').addComponents(
    textInput('name', 'Nome exibido', type?.name || '', TextInputStyle.Short, true, 100),
    textInput('description', 'Descrição no seletor', type?.description || '', TextInputStyle.Paragraph, true, 100),
    textInput('emoji', 'Emoji', type?.emoji || '🎫', TextInputStyle.Short, false, 100),
    textInput('channel', 'Modelo do nome do canal', type?.channelNameTemplate || config.ticket.defaultNameTemplate, TextInputStyle.Short, true, 100),
    textInput('id', 'ID interno (opcional)', type?.id || '', TextInputStyle.Short, false, 40)
  );
}

function questionModal(question = null) {
  return new ModalBuilder().setCustomId(`config:submit:question:${question?.id || 'new'}`).setTitle(question ? 'Editar pergunta' : 'Nova pergunta').addComponents(
    textInput('text', 'Pergunta', question?.text || '', TextInputStyle.Paragraph, true, 500),
    textInput('description', 'Explicação (opcional)', question?.description || '', TextInputStyle.Paragraph, false, 700),
    textInput('kind', 'Tipo: single ou text', question?.kind || 'single', TextInputStyle.Short, true, 10),
    textInput('options', 'Opções, uma por linha (single)', question?.options?.join('\n') || '', TextInputStyle.Paragraph, false, 1500),
    textInput('required', 'Obrigatória? sim/não', question?.required === false ? 'não' : 'sim', TextInputStyle.Short, true, 5)
  );
}

function questionnaireTextsModal(config) {
  return new ModalBuilder().setCustomId('config:submit:qtexts').setTitle('Textos do questionário').addComponents(
    textInput('title', 'Título', config.questionnaire.title, TextInputStyle.Short, true, 200),
    textInput('intro', 'Introdução', config.questionnaire.intro, TextInputStyle.Paragraph, true, 1500)
  );
}

function templateModal(key, value) {
  const max = TEMPLATE_LIMITS[key] || 2000;
  return new ModalBuilder().setCustomId(`config:submit:template:${key}`).setTitle(`Template: ${truncate(key, 30)}`).addComponents(
    textInput('value', 'Conteúdo', value || '', max > 256 ? TextInputStyle.Paragraph : TextInputStyle.Short, true, max)
  );
}

function presetModal(kind, preset = null) {
  return new ModalBuilder().setCustomId(`config:submit:preset:${kind}:${preset?.id || 'new'}`).setTitle(preset ? 'Editar preset' : 'Novo preset').addComponents(
    textInput('label', 'Nome do preset', preset?.label || '', TextInputStyle.Short, true, 100),
    textInput('text', 'Mensagem do preset', preset?.text || '', TextInputStyle.Paragraph, true, 2000),
    textInput('id', 'ID curto (opcional)', preset?.id || '', TextInputStyle.Short, false, 40)
  );
}

function ratingModal(config) {
  return new ModalBuilder().setCustomId('config:submit:rating').setTitle('Editar avaliação').addComponents(
    textInput('title', 'Título', config.rating.promptTitle, TextInputStyle.Short, true, 200),
    textInput('prompt', 'Texto da avaliação', config.rating.promptText, TextInputStyle.Paragraph, true, 1000),
    textInput('thanks', 'Mensagem de agradecimento', config.rating.thanksText, TextInputStyle.Paragraph, true, 1000),
    textInput('timeout', 'Tempo no ticket (segundos)', String(config.rating.ticketTimeoutSeconds), TextInputStyle.Short, true, 8)
  );
}

function securityModal(config) {
  return new ModalBuilder().setCustomId('config:submit:security').setTitle('Regras numéricas').addComponents(
    textInput('max', 'Máximo de tickets ativos por usuário', String(config.ticket.maxActiveTicketsPerUser), TextInputStyle.Short, true, 3),
    textInput('cooldown', 'Cooldown de abertura (segundos)', String(config.security.cooldownSeconds), TextInputStyle.Short, true, 4),
    textInput('delete', 'Apagar após fechar (segundos)', String(config.ticket.deleteAfterCloseSeconds), TextInputStyle.Short, true, 6),
    textInput('counter', 'ID mínimo do próximo ticket', String(config.ticket.counterStart), TextInputStyle.Short, true, 10),
    textInput('defaultname', 'Nome padrão dos canais', config.ticket.defaultNameTemplate, TextInputStyle.Short, true, 100)
  );
}

function ticketRulesModal(config) {
  return new ModalBuilder().setCustomId('config:submit:ticketrules').setTitle('Tópico e call').addComponents(
    textInput('topic', 'Template do tópico do ticket', config.ticket.topicTemplate, TextInputStyle.Paragraph, true, 1000),
    textInput('call', 'Template do nome da call', config.ticket.callNameTemplate, TextInputStyle.Short, true, 100)
  );
}

function pickerEmbed(config, title, description) {
  return new EmbedBuilder().setColor(config.branding.color).setTitle(title).setDescription(description);
}

function isValidHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function pagedSelectPayload(config, {
  title,
  items,
  page = 0,
  pageSize = 25,
  menuId,
  placeholder,
  pagePrefix,
  mapOption,
  backId
}) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  page = Math.max(0, Math.min(Number(page) || 0, pages - 1));
  const slice = items.slice(page * pageSize, page * pageSize + pageSize);
  const embed = pickerEmbed(config, `${title} • ${page + 1}/${pages}`, slice.length ? 'Escolha abaixo.' : 'Nenhum item cadastrado.');
  const rows = [];
  if (slice.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(menuId).setPlaceholder(placeholder).addOptions(slice.map(mapOption))
    ));
  }
  if (pages > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${pagePrefix}:${page - 1}`).setLabel('Anterior').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
      new ButtonBuilder().setCustomId(`${pagePrefix}:${page + 1}`).setLabel('Próxima').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1)
    ));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(backId).setLabel('Voltar').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
  ));
  return { embeds: [embed], components: rows };
}

function selectorPicker(config, action, page = 0) {
  const titles = { edit: '✏️ Editar seletor', toggle: '🔁 Ativar/Desativar seletor', delete: '🗑️ Excluir seletor' };
  return pagedSelectPayload(config, {
    title: titles[action] || 'Selecionar',
    items: config.panel.selectors || [],
    page,
    menuId: `config:selector:${action}`,
    placeholder: 'Selecione',
    pagePrefix: `config:selectorpickpage:${action}`,
    mapOption: s => ({ label: truncate(s.name, 100), value: s.id, description: truncate(`${s.enabled ? 'Ativo' : 'Desativado'} • ${s.placeholder}`, 100) }),
    backId: 'config:selectors'
  });
}

function questionPicker(config, page = 0) {
  return pagedSelectPayload(config, {
    title: '🧠 Gerenciar perguntas',
    items: config.questionnaire.questions || [],
    page,
    menuId: 'config:q:pick',
    placeholder: 'Pergunta',
    pagePrefix: 'config:qmanagepage',
    mapOption: q => ({ label: truncate(q.text, 100), value: q.id, description: q.kind === 'text' ? 'Resposta aberta' : 'Seleção' }),
    backId: 'config:questionnaire'
  });
}

function allPresets(config) {
  const items = [];
  for (const kind of ['moderation', 'results']) {
    for (const preset of (config.presets[kind] || [])) items.push({ kind, preset });
  }
  return items;
}

function presetPicker(config, page = 0) {
  return pagedSelectPayload(config, {
    title: '🧰 Gerenciar presets',
    items: allPresets(config),
    page,
    menuId: 'config:preset:pick',
    placeholder: 'Escolha o preset',
    pagePrefix: 'config:presetmanagepage',
    mapOption: item => ({
      label: truncate(item.preset.label, 100),
      value: `${item.kind}|${item.preset.id}`,
      description: item.kind === 'moderation' ? 'Preset de moderação' : 'Preset de resultado'
    }),
    backId: 'config:presets'
  });
}

async function deleteOldPanelMessage(interaction, oldChannelId, oldMessageId) {
  if (!oldChannelId || !oldMessageId) return;
  const channel = interaction.guild.channels.cache.get(oldChannelId)
    || await interaction.guild.channels.fetch(oldChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(oldMessageId).catch(() => null);
  if (message) await message.delete().catch(() => null);
}

async function handleConfigComponent(interaction) {
  const id = interaction.customId;
  const config = await getGuildConfig(interaction.guildId);

  if (id === 'config:home' || id === 'config:refresh') return showHome(interaction);
  if (id === 'config:permissions') return showNamed(interaction, 'permissionsPanel');
  if (id === 'config:panel') return showNamed(interaction, 'panelSettings');
  if (id === 'config:selectors') return showNamed(interaction, 'selectorsPanel');
  if (id === 'config:types') return showNamed(interaction, 'ticketTypesPanel', 0);
  if (id === 'config:questionnaire') return showNamed(interaction, 'questionnairePanel');
  if (id === 'config:logs') return showNamed(interaction, 'logsPanel');
  if (id === 'config:rating') return showNamed(interaction, 'ratingPanel');
  if (id === 'config:templates') return showNamed(interaction, 'templatesPanel');
  if (id === 'config:presets') return showNamed(interaction, 'presetsPanel');
  if (id === 'config:security') return showNamed(interaction, 'securityPanel');
  if (id === 'config:variables') return showNamed(interaction, 'variablesPanel');
  if (id === 'config:backup') return showNamed(interaction, 'backupPanel');
  if (id.startsWith('config:typespage:')) return showNamed(interaction, 'ticketTypesPanel', Number(id.split(':').pop()) || 0);
  if (id.startsWith('config:typepickpage:')) {
    const parts = id.split(':');
    return updateView(interaction, views.typePicker(config, parts[2], Number(parts[3]) || 0));
  }
  if (id.startsWith('config:selectorpickpage:')) {
    const parts = id.split(':');
    return updateView(interaction, selectorPicker(config, parts[2], Number(parts[3]) || 0));
  }
  if (id.startsWith('config:qmanagepage:')) return updateView(interaction, questionPicker(config, Number(id.split(':').pop()) || 0));
  if (id.startsWith('config:presetmanagepage:')) return updateView(interaction, presetPicker(config, Number(id.split(':').pop()) || 0));

  if (id === 'config:modal:branding') return interaction.showModal(brandingModal(config));
  if (id === 'config:modal:paneldesc') return interaction.showModal(panelDescModal(config));
  if (id === 'config:modal:rating') return interaction.showModal(ratingModal(config));
  if (id === 'config:modal:security') return interaction.showModal(securityModal(config));
  if (id === 'config:modal:ticketrules') return interaction.showModal(ticketRulesModal(config));

  if (id === 'config:permissions:toggleowner') {
    config.permissions.allowGuildOwner = !config.permissions.allowGuildOwner;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.permissionsPanel(config));
  }

  if (id === 'config:panelpreview') {
    const preview = panelMessage(config, interaction.guild);
    preview.components = [];
    return privateReply(interaction, { content: '👁️ **Prévia do painel:**', ...preview });
  }

  if (id === 'config:selector:new') return interaction.showModal(selectorModal(config));
  if (id === 'config:selector:editpick') return updateView(interaction, selectorPicker(config, 'edit', 0));
  if (id === 'config:selector:togglepick') return updateView(interaction, selectorPicker(config, 'toggle', 0));
  if (id === 'config:selector:deletepick') return updateView(interaction, selectorPicker(config, 'delete', 0));

  if (id === 'config:type:new') return interaction.showModal(ticketTypeModal(config));
  if (id === 'config:type:pick') return updateView(interaction, views.typePicker(config, 'open', 0));
  if (id === 'config:type:deletepick') return updateView(interaction, views.typePicker(config, 'delete', 0));

  if (id.startsWith('config:typeedit:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
    return interaction.showModal(ticketTypeModal(config, type));
  }

  if (id.startsWith('config:typechannel:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
    const modal = new ModalBuilder().setCustomId(`config:submit:typechannel:${type.id}`).setTitle('Nome do canal').addComponents(
      textInput('value', 'Modelo de nome do canal', type.channelNameTemplate || config.ticket.defaultNameTemplate, TextInputStyle.Short, true, 100)
    );
    return interaction.showModal(modal);
  }

  if (id.startsWith('config:typeselector:')) {
    const typeId = id.split(':').pop();
    const options = config.panel.selectors.filter(s => s.enabled).slice(0, 25).map(s => ({ label: s.name, value: s.id, description: s.placeholder }));
    if (!options.length) return privateReply(interaction, { content: 'Crie e ative um seletor primeiro.' });
    const menu = new StringSelectMenuBuilder().setCustomId(`config:set:typeselector:${typeId}`).setPlaceholder('Escolha o seletor').addOptions(options);
    return privateReply(interaction, { content: 'Escolha onde esse tipo deve aparecer:', components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (id.startsWith('config:typetoggle:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
    type.enabled = !type.enabled;
    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    return updateView(interaction, views.ticketTypeEditor(config, type));
  }

  if (id.startsWith('config:typequestion:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
    type.requireQuestionnaire = type.requireQuestionnaire === false;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.ticketTypeEditor(config, type));
  }

  if (id.startsWith('config:typelogs:')) {
    const typeId = id.split(':').pop();
    const options = LOG_EVENTS.filter(([key]) => key !== 'questionnaire').map(([value, label]) => ({ label, value }));
    const menu = new StringSelectMenuBuilder().setCustomId(`config:typelogevent:${typeId}`).setPlaceholder('Qual evento deseja configurar?').addOptions(options);
    return privateReply(interaction, {
      content: 'Escolha o evento de log deste tipo:',
      components: [
        new ActionRowBuilder().addComponents(menu),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`config:typelogclear:${typeId}`).setLabel('Limpar todos os overrides').setEmoji('🧹').setStyle(ButtonStyle.Danger))
      ]
    });
  }

  if (id.startsWith('config:typelogclear:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
    type.logChannelIds = {};
    type.logChannelId = null;
    await saveGuildConfig(interaction.guildId, config);
    return interaction.update({ content: '✅ Logs específicos removidos. O tipo voltou a herdar os destinos globais.', components: [] });
  }

  if (id === 'config:q:new') return interaction.showModal(questionModal());
  if (id === 'config:q:texts') return interaction.showModal(questionnaireTextsModal(config));
  if (id === 'config:q:manage') return updateView(interaction, questionPicker(config, 0));
  if (id === 'config:q:version') {
    config.questionnaire.version = Number(config.questionnaire.version || 1) + 1;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.questionnairePanel(config));
  }
  if (id === 'config:q:toggle') {
    config.questionnaire.enabled = !config.questionnaire.enabled;
    config.questionnaire.requiredBeforeTicket = config.questionnaire.enabled;
    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    return updateView(interaction, views.questionnairePanel(config));
  }
  if (id.startsWith('config:qedit:')) {
    const q = config.questionnaire.questions.find(x => x.id === id.split(':').pop());
    if (!q) return privateReply(interaction, { content: 'Pergunta não encontrada.' });
    return interaction.showModal(questionModal(q));
  }
  if (id.startsWith('config:qdelete:')) {
    const qid = id.split(':').pop();
    config.questionnaire.questions = config.questionnaire.questions.filter(q => q.id !== qid);
    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    return updateView(interaction, views.questionnairePanel(config));
  }

  if (id === 'config:log:eventpick') {
    const menu = new StringSelectMenuBuilder().setCustomId('config:log:event').setPlaceholder('Escolha o evento').addOptions(LOG_EVENTS.map(([value, label]) => ({ value, label })));
    return privateReply(interaction, { content: 'Escolha o evento:', components: [new ActionRowBuilder().addComponents(menu)] });
  }
  if (id === 'config:logs:clear') {
    for (const key of Object.keys(config.logs.events)) config.logs.events[key] = null;
    config.rating.logChannelId = null;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.logsPanel(config));
  }

  if (id === 'config:rating:toggle') {
    config.rating.enabled = !config.rating.enabled;
    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    return updateView(interaction, views.ratingPanel(config));
  }
  if (id === 'config:rating:togglecomment') {
    config.rating.requireComment = !config.rating.requireComment;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.ratingPanel(config));
  }

  if (id === 'config:security:oneopen') {
    config.ticket.oneOpenPerUser = !config.ticket.oneOpenPerUser;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.securityPanel(config));
  }
  if (id === 'config:security:transcript') {
    config.ticket.transcriptEnabled = !config.ticket.transcriptEnabled;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.securityPanel(config));
  }
  if (id === 'config:security:dmtranscript') {
    config.ticket.dmTranscript = !config.ticket.dmTranscript;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.securityPanel(config));
  }
  if (id === 'config:security:preventbots') {
    config.security.preventBotsOpeningTickets = !config.security.preventBotsOpeningTickets;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.securityPanel(config));
  }

  if (id === 'config:backup:download') {
    const json = await backupString();
    const file = new AttachmentBuilder(Buffer.from(json, 'utf8'), { name: `rocha-ticket-backup-${interaction.guildId}.json` });
    return privateReply(interaction, { content: '💾 Backup atual do banco:', files: [file] });
  }

  if (id.startsWith('config:preset:new:')) {
    const kind = id.split(':').pop();
    return interaction.showModal(presetModal(kind));
  }
  if (id === 'config:preset:manage') return updateView(interaction, presetPicker(config, 0));
  if (id.startsWith('config:preset:edit:')) {
    const [, , , kind, presetId] = id.split(':');
    const preset = (config.presets[kind] || []).find(p => p.id === presetId);
    if (!preset) return privateReply(interaction, { content: 'Preset não encontrado.' });
    return interaction.showModal(presetModal(kind, preset));
  }
  if (id.startsWith('config:preset:delete:')) {
    const [, , , kind, presetId] = id.split(':');
    config.presets[kind] = (config.presets[kind] || []).filter(p => p.id !== presetId);
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.presetsPanel(config));
  }

  if (interaction.isAnySelectMenu()) {
    if (id === 'config:set:adminroles') {
      config.permissions.adminRoleIds = interaction.values;
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return updateView(interaction, views.permissionsPanel(config));
    }
    if (id === 'config:set:staffroles') {
      config.permissions.staffRoleIds = interaction.values;
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return updateView(interaction, views.permissionsPanel(config));
    }
    if (id === 'config:set:adminusers') {
      config.permissions.adminUserIds = interaction.values;
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return updateView(interaction, views.permissionsPanel(config));
    }
    if (id === 'config:set:panelchannel') {
      const oldChannelId = config.panel.channelId;
      const oldMessageId = config.panel.messageId;
      const newChannelId = interaction.values[0];
      if (newChannelId !== oldChannelId) await deleteOldPanelMessage(interaction, oldChannelId, oldMessageId);
      config.panel.channelId = newChannelId;
      config.panel.messageId = null;
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return updateView(interaction, views.panelSettings(config));
    }
    if (id === 'config:set:qchannel') {
      config.questionnaire.responseChannelId = interaction.values[0];
      config.logs.events.questionnaire = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return updateView(interaction, views.questionnairePanel(config));
    }
    if (id === 'config:set:defaultlog') {
      config.logs.defaultChannelId = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      return updateView(interaction, views.logsPanel(config));
    }
    if (id === 'config:set:ratinglog') {
      config.rating.logChannelId = interaction.values[0];
      config.logs.events.rating = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      return updateView(interaction, views.ratingPanel(config));
    }
    if (id === 'config:set:ratingmode') {
      config.rating.mode = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return updateView(interaction, views.ratingPanel(config));
    }
    if (id === 'config:set:ratingscale') {
      config.rating.scale = Math.max(3, Math.min(5, Number(interaction.values[0]) || 5));
      await saveGuildConfig(interaction.guildId, config);
      return updateView(interaction, views.ratingPanel(config));
    }

    if (id === 'config:selector:edit') {
      const selector = config.panel.selectors.find(x => x.id === interaction.values[0]);
      if (!selector) return privateReply(interaction, { content: 'Seletor não encontrado.' });
      return interaction.showModal(selectorModal(config, selector));
    }
    if (id === 'config:selector:toggle') {
      const selector = config.panel.selectors.find(x => x.id === interaction.values[0]);
      if (!selector) return privateReply(interaction, { content: 'Seletor não encontrado.' });
      selector.enabled = !selector.enabled;
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return updateView(interaction, views.selectorsPanel(config));
    }
    if (id === 'config:selector:delete') {
      const sid = interaction.values[0];
      if (config.ticketTypes.some(t => t.selectorId === sid)) {
        return privateReply(interaction, { content: 'Não posso excluir: existem tipos de ticket usando esse seletor. Mova-os primeiro.' });
      }
      config.panel.selectors = config.panel.selectors.filter(s => s.id !== sid);
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return updateView(interaction, views.selectorsPanel(config));
    }

    if (id === 'config:type:open') {
      const type = getTicketType(config, interaction.values[0]);
      if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
      return updateView(interaction, views.ticketTypeEditor(config, type));
    }
    if (id === 'config:type:delete') {
      const typeId = interaction.values[0];
      const db = await getState();
      const active = Object.values(db.tickets).some(t => t.guildId === interaction.guildId && t.typeId === typeId && ['creating', 'open', 'closing'].includes(t.status));
      if (active) return privateReply(interaction, { content: '❌ Não é possível excluir esse tipo enquanto existem tickets ativos usando ele. Desative o tipo e finalize os tickets primeiro.' });
      config.ticketTypes = config.ticketTypes.filter(t => t.id !== typeId);
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return updateView(interaction, views.ticketTypesPanel(config, 0));
    }
    if (id.startsWith('config:typecat:')) {
      const type = getTicketType(config, id.split(':').pop());
      if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
      type.parentCategoryId = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return updateView(interaction, views.ticketTypeEditor(config, type));
    }
    if (id.startsWith('config:typeroles:')) {
      const type = getTicketType(config, id.split(':').pop());
      if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
      type.staffRoleIds = interaction.values;
      await saveGuildConfig(interaction.guildId, config);
      return updateView(interaction, views.ticketTypeEditor(config, type));
    }
    if (id.startsWith('config:set:typeselector:')) {
      const typeId = id.split(':').pop();
      const type = getTicketType(config, typeId);
      if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
      type.selectorId = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      await recomputeSetup(interaction.guild);
      return interaction.update({ content: `✅ **${type.name}** agora aparece no seletor \`${type.selectorId}\`.`, components: [] });
    }
    if (id.startsWith('config:typelogevent:')) {
      const typeId = id.split(':').pop();
      const event = interaction.values[0];
      const channelMenu = new ChannelSelectMenuBuilder()
        .setCustomId(`config:typelogset:${typeId}:${event}`)
        .setPlaceholder(`Canal para ${event}`)
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1).setMaxValues(1);
      return interaction.update({ content: `Agora escolha o canal para o evento **${event}** desse tipo:`, components: [new ActionRowBuilder().addComponents(channelMenu)] });
    }
    if (id.startsWith('config:typelogset:')) {
      const [, , typeId, event] = id.split(':');
      const type = getTicketType(config, typeId);
      if (!type) return interaction.update({ content: 'Tipo não encontrado.', components: [] });
      type.logChannelIds ||= {};
      type.logChannelIds[event] = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      return interaction.update({ content: `✅ Log **${event}** de **${type.name}** → <#${interaction.values[0]}>`, components: [] });
    }

    if (id === 'config:q:pick') {
      const q = config.questionnaire.questions.find(x => x.id === interaction.values[0]);
      if (!q) return interaction.update({ content: 'Pergunta não encontrada.', components: [] });
      const embed = pickerEmbed(config, `🧠 ${truncate(q.text, 200)}`, `Tipo: \`${q.kind}\` • ${q.required ? 'obrigatória' : 'opcional'}\n${q.options?.length ? `Opções: ${truncate(q.options.join(', '), 3000)}` : ''}`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`config:qedit:${q.id}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`config:qdelete:${q.id}`).setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      );
      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (id === 'config:log:event') {
      const event = interaction.values[0];
      const channelMenu = new ChannelSelectMenuBuilder()
        .setCustomId(`config:log:set:${event}`)
        .setPlaceholder(`Canal para ${event}`)
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1).setMaxValues(1);
      return interaction.update({ content: `Escolha o canal para **${event}**:`, components: [new ActionRowBuilder().addComponents(channelMenu)] });
    }
    if (id.startsWith('config:log:set:')) {
      const event = id.split(':').pop();
      config.logs.events[event] = interaction.values[0];
      if (event === 'rating') config.rating.logChannelId = interaction.values[0];
      if (event === 'questionnaire') config.questionnaire.responseChannelId = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      return interaction.update({ content: `✅ Log **${event}** → <#${interaction.values[0]}>`, components: [] });
    }

    if (id === 'config:template:pick') {
      const key = interaction.values[0];
      return interaction.showModal(templateModal(key, config.templates[key]));
    }

    if (id === 'config:preset:pick') {
      const [kind, presetId] = interaction.values[0].split('|');
      const preset = (config.presets[kind] || []).find(p => p.id === presetId);
      if (!preset) return interaction.update({ content: 'Preset não encontrado.', components: [] });
      const embed = pickerEmbed(config, `🧰 ${preset.label}`, truncate(preset.text, 3500));
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`config:preset:edit:${kind}:${preset.id}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`config:preset:delete:${kind}:${preset.id}`).setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      );
      return interaction.update({ embeds: [embed], components: [row] });
    }
  }

  return false;
}

async function handleConfigModal(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('config:submit:')) return false;
  const config = await getGuildConfig(interaction.guildId);
  const get = name => interaction.fields.getTextInputValue(name).trim();

  if (id === 'config:submit:branding') {
    const color = get('color');
    const banner = get('banner');
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return privateReply(interaction, { content: '❌ Cor inválida. Use o formato `#F5A300`.' });
    if (!isValidHttpUrl(banner)) return privateReply(interaction, { content: '❌ A URL do banner é inválida. Use uma URL `http://` ou `https://`.' });
    config.branding.color = color;
    config.branding.logoEmoji = get('logo') || ':rocha:';
    config.branding.title = get('title');
    config.panel.bannerUrl = banner || null;
    config.branding.footer = get('footer');
    await saveGuildConfig(interaction.guildId, config);
    return privateReply(interaction, { ...views.panelSettings(config), content: '✅ Visual salvo.' });
  }

  if (id === 'config:submit:paneldesc') {
    config.panel.description = get('description');
    await saveGuildConfig(interaction.guildId, config);
    return privateReply(interaction, { ...views.panelSettings(config), content: '✅ Descrição salva.' });
  }

  if (id.startsWith('config:submit:selector:')) {
    const oldId = id.split(':').pop();
    const name = get('name');
    const placeholder = get('placeholder');
    const requested = slugify(get('id') || name).slice(0, 40);
    if (oldId === 'new') {
      let sid = requested || shortId('sel_');
      if (config.panel.selectors.some(s => s.id === sid)) sid = shortId('sel_');
      config.panel.selectors.push({ id: sid, name, placeholder, enabled: true });
    } else {
      const selector = config.panel.selectors.find(x => x.id === oldId);
      if (!selector) return privateReply(interaction, { content: 'Seletor não encontrado.' });
      selector.name = name;
      selector.placeholder = placeholder;
      if (requested && requested !== oldId && !config.panel.selectors.some(x => x.id === requested)) {
        for (const type of config.ticketTypes) if (type.selectorId === oldId) type.selectorId = requested;
        selector.id = requested;
      }
    }
    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    return privateReply(interaction, { ...views.selectorsPanel(config), content: '✅ Seletor salvo.' });
  }

  if (id.startsWith('config:submit:type:')) {
    const oldId = id.split(':').pop();
    const name = get('name');
    const description = get('description');
    const emoji = get('emoji') || '🎫';
    const channelNameTemplate = get('channel');
    const requestedRaw = get('id');
    const requested = slugify(requestedRaw || name).slice(0, 40);
    let type;

    if (oldId === 'new') {
      let tid = requested || shortId('tt_');
      if (config.ticketTypes.some(t => t.id === tid)) tid = `${tid.slice(0, 30)}-${shortId('').slice(0, 6)}`;
      type = {
        id: tid,
        name,
        description,
        emoji,
        enabled: true,
        selectorId: config.panel.selectors.find(s => s.enabled)?.id || null,
        parentCategoryId: null,
        channelNameTemplate,
        staffRoleIds: [],
        requireQuestionnaire: true,
        logChannelId: null,
        logChannelIds: {}
      };
      config.ticketTypes.push(type);
    } else {
      type = getTicketType(config, oldId);
      if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
      type.name = name;
      type.description = description;
      type.emoji = emoji;
      type.channelNameTemplate = channelNameTemplate;

      if (requestedRaw && requested !== oldId) {
        if (config.ticketTypes.some(t => t.id === requested)) {
          return privateReply(interaction, { content: `❌ Já existe um tipo com ID \`${requested}\`.` });
        }
        type.id = requested;
        await mutate(db => {
          for (const ticket of Object.values(db.tickets)) {
            if (ticket.guildId === interaction.guildId && ticket.typeId === oldId) ticket.typeId = requested;
          }
          for (const pending of Object.values(db.pendingQuestionnaires)) {
            if (pending.guildId === interaction.guildId && pending.typeId === oldId) pending.typeId = requested;
          }
        });
      }
    }

    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    return privateReply(interaction, {
      ...views.ticketTypeEditor(config, type),
      content: oldId === 'new' ? '✅ Tipo criado. Agora escolha a categoria do Discord e os cargos.' : '✅ Tipo atualizado.'
    });
  }

  if (id.startsWith('config:submit:typechannel:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return privateReply(interaction, { content: 'Tipo não encontrado.' });
    type.channelNameTemplate = get('value');
    await saveGuildConfig(interaction.guildId, config);
    return privateReply(interaction, { ...views.ticketTypeEditor(config, type), content: '✅ Modelo do canal salvo.' });
  }

  if (id === 'config:submit:qtexts') {
    config.questionnaire.title = get('title');
    config.questionnaire.intro = get('intro');
    await saveGuildConfig(interaction.guildId, config);
    return privateReply(interaction, { ...views.questionnairePanel(config), content: '✅ Textos do questionário salvos.' });
  }

  if (id.startsWith('config:submit:question:')) {
    const qid = id.split(':').pop();
    const kind = get('kind').toLowerCase();
    if (!['single', 'text'].includes(kind)) return privateReply(interaction, { content: '❌ Tipo deve ser `single` ou `text`.' });
    const options = get('options').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 15);
    if (kind === 'single' && options.length < 2) {
      return privateReply(interaction, { content: '❌ Perguntas `single` precisam de pelo menos 2 opções, uma por linha.' });
    }
    const data = {
      text: get('text'),
      description: get('description'),
      kind,
      options: kind === 'single' ? options : [],
      required: !['não', 'nao', 'no', 'false', '0'].includes(get('required').toLowerCase())
    };
    if (qid === 'new') {
      config.questionnaire.questions.push({ id: shortId('q_'), ...data });
    } else {
      const question = config.questionnaire.questions.find(q => q.id === qid);
      if (!question) return privateReply(interaction, { content: 'Pergunta não encontrada.' });
      Object.assign(question, data);
    }
    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    return privateReply(interaction, {
      ...views.questionnairePanel(config),
      content: '✅ Pergunta salva. Se quiser que usuários antigos respondam novamente, clique em **Nova versão**.'
    });
  }

  if (id.startsWith('config:submit:template:')) {
    const key = id.split(':').pop();
    if (!(key in config.templates)) return privateReply(interaction, { content: 'Template inválido.' });
    const value = get('value');
    const max = TEMPLATE_LIMITS[key] || 2000;
    if (value.length > max) return privateReply(interaction, { content: `❌ Esse template aceita no máximo ${max} caracteres.` });
    config.templates[key] = value;
    await saveGuildConfig(interaction.guildId, config);
    return privateReply(interaction, { ...views.templatesPanel(config), content: `✅ Template **${key}** atualizado.` });
  }

  if (id.startsWith('config:submit:preset:')) {
    const [, , , kind, oldId] = id.split(':');
    if (!['moderation', 'results'].includes(kind)) return privateReply(interaction, { content: 'Tipo de preset inválido.' });
    const label = get('label');
    const text = get('text');
    let requested = slugify(get('id') || label).slice(0, 40) || shortId('p_');
    config.presets[kind] ||= [];
    if (oldId === 'new') {
      if (config.presets[kind].some(p => p.id === requested)) requested = `${requested.slice(0, 30)}-${shortId('').slice(0, 6)}`;
      config.presets[kind].push({ id: requested, label, text });
    } else {
      const preset = config.presets[kind].find(p => p.id === oldId);
      if (!preset) return privateReply(interaction, { content: 'Preset não encontrado.' });
      preset.label = label;
      preset.text = text;
    }
    await saveGuildConfig(interaction.guildId, config);
    return privateReply(interaction, { ...views.presetsPanel(config), content: '✅ Preset salvo.' });
  }

  if (id === 'config:submit:rating') {
    config.rating.promptTitle = get('title');
    config.rating.promptText = get('prompt');
    config.rating.thanksText = get('thanks');
    config.rating.ticketTimeoutSeconds = Math.max(30, Math.min(86400, Number(get('timeout')) || 300));
    await saveGuildConfig(interaction.guildId, config);
    return privateReply(interaction, { ...views.ratingPanel(config), content: '✅ Avaliação atualizada.' });
  }

  if (id === 'config:submit:security') {
    const requestedCounter = Math.max(1, Number(get('counter')) || 1);
    config.ticket.maxActiveTicketsPerUser = Math.max(1, Math.min(20, Number(get('max')) || 1));
    config.security.cooldownSeconds = Math.max(0, Math.min(3600, Number(get('cooldown')) || 5));
    config.ticket.deleteAfterCloseSeconds = Math.max(0, Math.min(86400, Number(get('delete')) || 0));
    config.ticket.counterStart = requestedCounter;
    config.ticket.defaultNameTemplate = get('defaultname');
    await saveGuildConfig(interaction.guildId, config);

    await mutate(db => {
      const highest = Object.values(db.tickets)
        .filter(t => t.guildId === interaction.guildId && Number.isFinite(Number(t.number)))
        .reduce((max, t) => Math.max(max, Number(t.number)), 0);
      const current = Number(db.counters[interaction.guildId] || 1);
      db.counters[interaction.guildId] = Math.max(current, requestedCounter, highest + 1);
    });

    return privateReply(interaction, { ...views.securityPanel(config), content: '✅ Regras salvas. O contador nunca é reduzido para evitar IDs repetidos.' });
  }

  if (id === 'config:submit:ticketrules') {
    config.ticket.topicTemplate = get('topic');
    config.ticket.callNameTemplate = get('call');
    await saveGuildConfig(interaction.guildId, config);
    return privateReply(interaction, { ...views.securityPanel(config), content: '✅ Templates de tópico e call salvos.' });
  }

  return false;
}

module.exports = {
  handleConfigComponent,
  handleConfigModal,
  showHome,
  LOG_EVENTS
};
