const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { getGuildConfig, saveGuildConfig, backupString, mutate } = require('../database/store');
const { shortId, slugify } = require('../utils/ids');
const { truncate } = require('../utils/discord');
const { validateConfiguration, recomputeSetup, getTicketType } = require('../services/configService');
const views = require('../panels/configPanel');
const { panelMessage } = require('../panels/ticketPanel');

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

function textInput(id, label, value = '', style = TextInputStyle.Short, required = true, maxLength = 4000) {
  const input = new TextInputBuilder().setCustomId(id).setLabel(truncate(label, 45)).setStyle(style).setRequired(required).setMaxLength(maxLength);
  if (value != null && String(value).length) input.setValue(String(value).slice(0, maxLength));
  return new ActionRowBuilder().addComponents(input);
}

async function updateView(interaction, payload) {
  const clean = { ...payload };
  delete clean.ephemeral;
  if (interaction.isButton() || interaction.isAnySelectMenu()) return interaction.update(clean);
  return interaction.reply({ ...clean, ephemeral: true });
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
    textInput('id', 'ID interno (opcional ao criar)', type?.id || '', TextInputStyle.Short, false, 40)
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
  return new ModalBuilder().setCustomId(`config:submit:template:${key}`).setTitle(`Template: ${truncate(key, 30)}`).addComponents(
    textInput('value', 'Conteúdo', value || '', TextInputStyle.Paragraph, true, 4000)
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
    textInput('cooldown', 'Cooldown de interações (segundos)', String(config.security.cooldownSeconds), TextInputStyle.Short, true, 4),
    textInput('delete', 'Apagar após fechar (segundos)', String(config.ticket.deleteAfterCloseSeconds), TextInputStyle.Short, true, 6),
    textInput('counter', 'Próximo ID numérico do ticket', String(config.ticket.counterStart), TextInputStyle.Short, true, 10),
    textInput('defaultname', 'Nome padrão dos canais', config.ticket.defaultNameTemplate, TextInputStyle.Short, true, 100)
  );
}

function pickerEmbed(config, title, description) {
  return new EmbedBuilder().setColor(config.branding.color).setTitle(title).setDescription(description);
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

  if (id === 'config:modal:branding') return interaction.showModal(brandingModal(config));
  if (id === 'config:modal:paneldesc') return interaction.showModal(panelDescModal(config));
  if (id === 'config:modal:rating') return interaction.showModal(ratingModal(config));
  if (id === 'config:modal:security') return interaction.showModal(securityModal(config));

  if (id === 'config:panelpreview') {
    const preview = panelMessage(config, interaction.guild);
    preview.components = [];
    return interaction.reply({ content: '👁️ **Prévia do painel:**', ...preview, ephemeral: true });
  }

  if (id === 'config:selector:new') return interaction.showModal(selectorModal(config));
  if (id === 'config:selector:editpick' || id === 'config:selector:deletepick') {
    const deleting = id.includes('delete');
    const options = config.panel.selectors.slice(0, 25).map(s => ({ label: s.name, value: s.id, description: s.placeholder }));
    const embed = pickerEmbed(config, deleting ? '🗑️ Excluir seletor' : '✏️ Editar seletor', options.length ? 'Escolha abaixo.' : 'Nenhum seletor cadastrado.');
    const rows = [];
    if (options.length) rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(deleting ? 'config:selector:delete' : 'config:selector:edit').setPlaceholder('Selecione').addOptions(options)));
    rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('config:selectors').setLabel('Voltar').setStyle(ButtonStyle.Secondary)));
    return updateView(interaction, { embeds: [embed], components: rows });
  }

  if (id === 'config:type:new') return interaction.showModal(ticketTypeModal(config));
  if (id === 'config:type:pick') return updateView(interaction, views.typePicker(config, 'open'));
  if (id === 'config:type:deletepick') return updateView(interaction, views.typePicker(config, 'delete'));

  if (id.startsWith('config:typeedit:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return interaction.reply({ content: 'Tipo não encontrado.', ephemeral: true });
    return interaction.showModal(ticketTypeModal(config, type));
  }
  if (id.startsWith('config:typechannel:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return interaction.reply({ content: 'Tipo não encontrado.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId(`config:submit:typechannel:${type.id}`).setTitle('Nome do canal').addComponents(
      textInput('value', 'Modelo de nome do canal', type.channelNameTemplate || config.ticket.defaultNameTemplate, TextInputStyle.Short, true, 100)
    );
    return interaction.showModal(modal);
  }
  if (id.startsWith('config:typeselector:')) {
    const typeId = id.split(':').pop();
    const options = config.panel.selectors.filter(s => s.enabled).slice(0,25).map(s => ({ label: s.name, value: s.id, description: s.placeholder }));
    if (!options.length) return interaction.reply({ content: 'Crie um seletor primeiro.', ephemeral: true });
    const menu = new StringSelectMenuBuilder().setCustomId(`config:set:typeselector:${typeId}`).setPlaceholder('Escolha o seletor').addOptions(options);
    return interaction.reply({ content: 'Escolha onde esse tipo deve aparecer:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  }
  if (id.startsWith('config:typetoggle:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return interaction.reply({ content: 'Tipo não encontrado.', ephemeral: true });
    type.enabled = !type.enabled;
    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    return updateView(interaction, views.ticketTypeEditor(config, type));
  }
  if (id.startsWith('config:typequestion:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return interaction.reply({ content: 'Tipo não encontrado.', ephemeral: true });
    type.requireQuestionnaire = type.requireQuestionnaire === false ? true : false;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.ticketTypeEditor(config, type));
  }
  if (id.startsWith('config:typelogs:')) {
    const typeId = id.split(':').pop();
    const options = LOG_EVENTS.filter(([key]) => key !== 'questionnaire').map(([value, label]) => ({ label, value }));
    const menu = new StringSelectMenuBuilder().setCustomId(`config:typelogevent:${typeId}`).setPlaceholder('Qual evento deseja configurar?').addOptions(options);
    return interaction.reply({ content: 'Escolha o evento de log deste tipo:', components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`config:typelogclear:${typeId}`).setLabel('Limpar todos os overrides').setEmoji('🧹').setStyle(ButtonStyle.Danger))], ephemeral: true });
  }
  if (id.startsWith('config:typelogclear:')) {
    const type = getTicketType(config, id.split(':').pop());
    if (!type) return interaction.reply({ content: 'Tipo não encontrado.', ephemeral: true });
    type.logChannelIds = {};
    await saveGuildConfig(interaction.guildId, config);
    return interaction.update({ content: '✅ Logs específicos removidos. O tipo voltou a herdar os destinos globais.', components: [] });
  }

  if (id === 'config:q:new') return interaction.showModal(questionModal());
  if (id === 'config:q:texts') return interaction.showModal(questionnaireTextsModal(config));
  if (id === 'config:q:manage') {
    const options = config.questionnaire.questions.slice(0,25).map(q => ({ label: truncate(q.text, 100), value: q.id, description: q.kind === 'text' ? 'Resposta aberta' : 'Seleção' }));
    if (!options.length) return interaction.reply({ content: 'Ainda não existem perguntas.', ephemeral: true });
    return interaction.reply({ content: 'Escolha a pergunta:', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('config:q:pick').setPlaceholder('Pergunta').addOptions(options))], ephemeral: true });
  }
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
    if (!q) return interaction.reply({ content: 'Pergunta não encontrada.', ephemeral: true });
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
    const menu = new StringSelectMenuBuilder().setCustomId('config:log:event').setPlaceholder('Escolha o evento').addOptions(LOG_EVENTS.map(([value,label]) => ({ value, label })));
    return interaction.reply({ content: 'Escolha o evento:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  }
  if (id === 'config:logs:clear') {
    for (const key of Object.keys(config.logs.events)) config.logs.events[key] = null;
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.logsPanel(config));
  }

  if (id === 'config:rating:toggle') {
    config.rating.enabled = !config.rating.enabled;
    await saveGuildConfig(interaction.guildId, config);
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

  if (id === 'config:backup:download') {
    const json = await backupString();
    const file = new AttachmentBuilder(Buffer.from(json, 'utf8'), { name: `rocha-ticket-backup-${interaction.guildId}.json` });
    return interaction.reply({ content: '💾 Backup atual do banco:', files: [file], ephemeral: true });
  }


  if (id.startsWith('config:preset:new:')) {
    const kind = id.split(':').pop();
    return interaction.showModal(presetModal(kind));
  }
  if (id === 'config:preset:manage') {
    const options = [];
    for (const kind of ['moderation', 'results']) {
      for (const p of (config.presets[kind] || [])) {
        options.push({ label: truncate(p.label, 100), value: `${kind}|${p.id}`, description: kind === 'moderation' ? 'Preset de moderação' : 'Preset de resultado' });
      }
    }
    if (!options.length) return interaction.reply({ content: 'Nenhum preset cadastrado.', ephemeral: true });
    const menu = new StringSelectMenuBuilder().setCustomId('config:preset:pick').setPlaceholder('Escolha o preset').addOptions(options.slice(0,25));
    return interaction.reply({ content: 'Escolha o preset:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  }
  if (id.startsWith('config:preset:edit:')) {
    const [, , , kind, presetId] = id.split(':');
    const preset = (config.presets[kind] || []).find(p => p.id === presetId);
    if (!preset) return interaction.reply({ content: 'Preset não encontrado.', ephemeral: true });
    return interaction.showModal(presetModal(kind, preset));
  }
  if (id.startsWith('config:preset:delete:')) {
    const [, , , kind, presetId] = id.split(':');
    config.presets[kind] = (config.presets[kind] || []).filter(p => p.id !== presetId);
    await saveGuildConfig(interaction.guildId, config);
    return updateView(interaction, views.presetsPanel(config));
  }

  // Select menus
  if (interaction.isAnySelectMenu()) {
    if (id === 'config:set:adminroles') {
      config.permissions.adminRoleIds = interaction.values;
      await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
      return updateView(interaction, views.permissionsPanel(config));
    }
    if (id === 'config:set:staffroles') {
      config.permissions.staffRoleIds = interaction.values;
      await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
      return updateView(interaction, views.permissionsPanel(config));
    }
    if (id === 'config:set:adminusers') {
      config.permissions.adminUserIds = interaction.values;
      await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
      return updateView(interaction, views.permissionsPanel(config));
    }
    if (id === 'config:set:panelchannel') {
      config.panel.channelId = interaction.values[0]; config.panel.messageId = null;
      await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
      return updateView(interaction, views.panelSettings(config));
    }
    if (id === 'config:set:qchannel') {
      config.questionnaire.responseChannelId = interaction.values[0];
      config.logs.events.questionnaire = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
      return updateView(interaction, views.questionnairePanel(config));
    }
    if (id === 'config:set:defaultlog') {
      config.logs.defaultChannelId = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      return updateView(interaction, views.logsPanel(config));
    }
    if (id === 'config:set:ratinglog') {
      config.rating.logChannelId = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      return updateView(interaction, views.ratingPanel(config));
    }
    if (id === 'config:set:ratingmode') {
      config.rating.mode = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
      return updateView(interaction, views.ratingPanel(config));
    }
    if (id === 'config:selector:edit') {
      const s = config.panel.selectors.find(x => x.id === interaction.values[0]);
      if (!s) return interaction.reply({ content: 'Seletor não encontrado.', ephemeral: true });
      return interaction.showModal(selectorModal(config, s));
    }
    if (id === 'config:selector:delete') {
      const sid = interaction.values[0];
      if (config.ticketTypes.some(t => t.selectorId === sid)) return interaction.reply({ content: 'Não posso excluir: existem tipos de ticket usando esse seletor. Mova-os primeiro.', ephemeral: true });
      config.panel.selectors = config.panel.selectors.filter(s => s.id !== sid);
      await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
      return updateView(interaction, views.selectorsPanel(config));
    }
    if (id === 'config:type:open') {
      const type = getTicketType(config, interaction.values[0]);
      return updateView(interaction, views.ticketTypeEditor(config, type));
    }
    if (id === 'config:type:delete') {
      config.ticketTypes = config.ticketTypes.filter(t => t.id !== interaction.values[0]);
      await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
      return updateView(interaction, views.ticketTypesPanel(config, 0));
    }
    if (id.startsWith('config:typecat:')) {
      const type = getTicketType(config, id.split(':').pop());
      type.parentCategoryId = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
      return updateView(interaction, views.ticketTypeEditor(config, type));
    }
    if (id.startsWith('config:typeroles:')) {
      const type = getTicketType(config, id.split(':').pop());
      type.staffRoleIds = interaction.values;
      await saveGuildConfig(interaction.guildId, config);
      return updateView(interaction, views.ticketTypeEditor(config, type));
    }
    if (id.startsWith('config:set:typeselector:')) {
      const typeId = id.split(':').pop();
      const type = getTicketType(config, typeId);
      type.selectorId = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
      return interaction.update({ content: `✅ **${type.name}** agora aparece no seletor \`${type.selectorId}\`.`, components: [] });
    }
    if (id.startsWith('config:typelogevent:')) {
      const typeId = id.split(':').pop();
      const event = interaction.values[0];
      const channelMenu = new ChannelSelectMenuBuilder().setCustomId(`config:typelogset:${typeId}:${event}`).setPlaceholder(`Canal para ${event}`).setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1);
      return interaction.update({ content: `Agora escolha o canal para o evento **${event}** desse tipo:`, components: [new ActionRowBuilder().addComponents(channelMenu)] });
    }
    if (id.startsWith('config:typelogset:')) {
      const [, , typeId, event] = id.split(':');
      const type = getTicketType(config, typeId);
      type.logChannelIds ||= {};
      type.logChannelIds[event] = interaction.values[0];
      await saveGuildConfig(interaction.guildId, config);
      return interaction.update({ content: `✅ Log **${event}** de **${type.name}** → <#${interaction.values[0]}>`, components: [] });
    }
    if (id === 'config:q:pick') {
      const q = config.questionnaire.questions.find(x => x.id === interaction.values[0]);
      const embed = pickerEmbed(config, `🧠 ${truncate(q.text, 200)}`, `Tipo: \`${q.kind}\` • ${q.required ? 'obrigatória' : 'opcional'}\n${q.options?.length ? `Opções: ${q.options.join(', ')}` : ''}`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`config:qedit:${q.id}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`config:qdelete:${q.id}`).setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      );
      return interaction.update({ embeds: [embed], components: [row] });
    }
    if (id === 'config:log:event') {
      const event = interaction.values[0];
      const channelMenu = new ChannelSelectMenuBuilder().setCustomId(`config:log:set:${event}`).setPlaceholder(`Canal para ${event}`).setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1);
      return interaction.update({ content: `Escolha o canal para **${event}**:`, components: [new ActionRowBuilder().addComponents(channelMenu)] });
    }
    if (id.startsWith('config:log:set:')) {
      const event = id.split(':').pop();
      config.logs.events[event] = interaction.values[0];
      if (event === 'rating') config.rating.logChannelId ||= interaction.values[0];
      if (event === 'questionnaire') config.questionnaire.responseChannelId ||= interaction.values[0];
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
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return interaction.reply({ content: '❌ Cor inválida. Use o formato `#F5A300`.', ephemeral: true });
    config.branding.color = color;
    config.branding.logoEmoji = get('logo') || ':rocha:';
    config.branding.title = get('title');
    config.panel.bannerUrl = get('banner') || null;
    config.branding.footer = get('footer');
    await saveGuildConfig(interaction.guildId, config);
    return interaction.reply({ ...views.panelSettings(config), content: '✅ Visual salvo.', ephemeral: true });
  }
  if (id === 'config:submit:paneldesc') {
    config.panel.description = get('description');
    await saveGuildConfig(interaction.guildId, config);
    return interaction.reply({ ...views.panelSettings(config), content: '✅ Descrição salva.', ephemeral: true });
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
      const s = config.panel.selectors.find(x => x.id === oldId);
      if (!s) return interaction.reply({ content: 'Seletor não encontrado.', ephemeral: true });
      s.name = name; s.placeholder = placeholder;
      if (requested && requested !== oldId && !config.panel.selectors.some(x => x.id === requested)) {
        for (const t of config.ticketTypes) if (t.selectorId === oldId) t.selectorId = requested;
        s.id = requested;
      }
    }
    await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
    return interaction.reply({ ...views.selectorsPanel(config), content: '✅ Seletor salvo.', ephemeral: true });
  }
  if (id.startsWith('config:submit:type:')) {
    const oldId = id.split(':').pop();
    const name = get('name');
    const description = get('description');
    const emoji = get('emoji') || '🎫';
    const channelNameTemplate = get('channel');
    const requested = slugify(get('id') || '').slice(0, 40);
    let type;
    if (oldId === 'new') {
      let tid = requested || shortId('tt_');
      if (config.ticketTypes.some(t => t.id === tid)) tid = shortId('tt_');
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
      if (!type) return interaction.reply({ content: 'Tipo não encontrado.', ephemeral: true });
      type.name = name; type.description = description; type.emoji = emoji; type.channelNameTemplate = channelNameTemplate;
    }
    await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
    return interaction.reply({ ...views.ticketTypeEditor(config, type), content: oldId === 'new' ? '✅ Tipo criado. Agora escolha a categoria do Discord e os cargos.' : '✅ Tipo atualizado.', ephemeral: true });
  }
  if (id.startsWith('config:submit:typechannel:')) {
    const type = getTicketType(config, id.split(':').pop());
    type.channelNameTemplate = get('value');
    await saveGuildConfig(interaction.guildId, config);
    return interaction.reply({ ...views.ticketTypeEditor(config, type), content: '✅ Modelo do canal salvo.', ephemeral: true });
  }
  if (id === 'config:submit:qtexts') {
    config.questionnaire.title = get('title');
    config.questionnaire.intro = get('intro');
    await saveGuildConfig(interaction.guildId, config);
    return interaction.reply({ ...views.questionnairePanel(config), content: '✅ Textos do questionário salvos.', ephemeral: true });
  }
  if (id.startsWith('config:submit:question:')) {
    const qid = id.split(':').pop();
    const kind = get('kind').toLowerCase();
    if (!['single','text'].includes(kind)) return interaction.reply({ content: '❌ Tipo deve ser `single` ou `text`.', ephemeral: true });
    const options = get('options').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 15);
    if (kind === 'single' && options.length < 2) return interaction.reply({ content: '❌ Perguntas `single` precisam de pelo menos 2 opções, uma por linha.', ephemeral: true });
    const data = {
      text: get('text'),
      description: get('description'),
      kind,
      options: kind === 'single' ? options : [],
      required: !['não','nao','no','false','0'].includes(get('required').toLowerCase())
    };
    if (qid === 'new') config.questionnaire.questions.push({ id: shortId('q_'), ...data });
    else Object.assign(config.questionnaire.questions.find(q => q.id === qid), data);
    await saveGuildConfig(interaction.guildId, config); await recomputeSetup(interaction.guild);
    return interaction.reply({ ...views.questionnairePanel(config), content: '✅ Pergunta salva. Se quiser que usuários antigos respondam novamente, clique em **Nova versão**.', ephemeral: true });
  }
  if (id.startsWith('config:submit:template:')) {
    const key = id.split(':').pop();
    if (!(key in config.templates)) return interaction.reply({ content: 'Template inválido.', ephemeral: true });
    config.templates[key] = get('value');
    await saveGuildConfig(interaction.guildId, config);
    return interaction.reply({ ...views.templatesPanel(config), content: `✅ Template **${key}** atualizado.`, ephemeral: true });
  }

  if (id.startsWith('config:submit:preset:')) {
    const [, , , kind, oldId] = id.split(':');
    if (!['moderation','results'].includes(kind)) return interaction.reply({ content: 'Tipo de preset inválido.', ephemeral: true });
    const label = get('label');
    const text = get('text');
    let requested = slugify(get('id') || label).slice(0, 40) || shortId('p_');
    config.presets[kind] ||= [];
    if (oldId === 'new') {
      if (config.presets[kind].some(p => p.id === requested)) requested = shortId('p_');
      config.presets[kind].push({ id: requested, label, text });
    } else {
      const preset = config.presets[kind].find(p => p.id === oldId);
      if (!preset) return interaction.reply({ content: 'Preset não encontrado.', ephemeral: true });
      preset.label = label; preset.text = text;
    }
    await saveGuildConfig(interaction.guildId, config);
    return interaction.reply({ ...views.presetsPanel(config), content: '✅ Preset salvo.', ephemeral: true });
  }
  if (id === 'config:submit:rating') {
    config.rating.promptTitle = get('title');
    config.rating.promptText = get('prompt');
    config.rating.thanksText = get('thanks');
    config.rating.ticketTimeoutSeconds = Math.max(30, Number(get('timeout')) || 300);
    await saveGuildConfig(interaction.guildId, config);
    return interaction.reply({ ...views.ratingPanel(config), content: '✅ Avaliação atualizada.', ephemeral: true });
  }
  if (id === 'config:submit:security') {
    config.ticket.maxActiveTicketsPerUser = Math.max(1, Math.min(20, Number(get('max')) || 1));
    config.security.cooldownSeconds = Math.max(0, Math.min(3600, Number(get('cooldown')) || 5));
    config.ticket.deleteAfterCloseSeconds = Math.max(0, Math.min(86400, Number(get('delete')) || 3));
    config.ticket.counterStart = Math.max(1, Number(get('counter')) || 1);
    config.ticket.defaultNameTemplate = get('defaultname');
    await saveGuildConfig(interaction.guildId, config);
    await mutate(db => { db.counters[interaction.guildId] = config.ticket.counterStart; });
    return interaction.reply({ ...views.securityPanel(config), content: '✅ Regras salvas.', ephemeral: true });
  }
  return false;
}

module.exports = { handleConfigComponent, handleConfigModal, showHome, LOG_EVENTS };
