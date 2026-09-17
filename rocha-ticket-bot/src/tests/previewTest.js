const assert = require('node:assert/strict');
const { defaultGuildConfig } = require('../config/defaultConfig');
const { duplicatedCustomIds } = require('../services/diagnosticService');
const {
  previewMenu,
  buildPublicPreview,
  buildCreatedPreview,
  buildTicketPreview,
  buildQuestionnairePreview,
  buildRatingPreview,
  buildClosePreview,
  buildLogsPreview,
  buildPresetsPreview
} = require('../services/previewService');

function json(component) {
  return typeof component?.toJSON === 'function' ? component.toJSON() : component;
}

function validate(name, payload) {
  assert.ok(payload, `${name}: payload ausente`);
  assert.ok((payload.embeds || []).length <= 10, `${name}: mais de 10 embeds`);
  assert.ok((payload.components || []).length <= 5, `${name}: mais de 5 ActionRows`);
  assert.deepEqual(duplicatedCustomIds(payload), [], `${name}: custom_id duplicado`);
  for (const row of payload.components || []) {
    const raw = json(row);
    assert.ok((raw.components || []).length <= 5, `${name}: mais de 5 componentes em uma ActionRow`);
    for (const component of raw.components || []) {
      if (component.custom_id) assert.ok(component.custom_id.length <= 100, `${name}: custom_id maior que 100 caracteres`);
      if (component.type === 3) assert.ok((component.options || []).length <= 25, `${name}: select com mais de 25 opções`);
    }
  }
}

function run() {
  const config = defaultGuildConfig('123456789012345678');
  config.ticketTypes = [{
    id: 'suporte',
    name: 'Suporte',
    description: 'Ajuda geral',
    emoji: '🛠️',
    enabled: true,
    selectorId: 'principal',
    parentCategoryId: '111111111111111111',
    channelNameTemplate: 'ticket-{ticket_type_slug}-{ticket_id}',
    staffRoleIds: [],
    requireQuestionnaire: true,
    logChannelIds: {}
  }];
  config.questionnaire.questions = [
    {
      id: 'origem',
      text: 'Como conheceu o Rocha?',
      description: 'Escolha uma opção.',
      kind: 'single',
      options: ['TikTok', 'Instagram', 'Amigos'],
      required: true
    },
    {
      id: 'motivo',
      text: 'Qual o motivo do contato?',
      description: 'Explique com detalhes.',
      kind: 'text',
      options: [],
      required: true
    }
  ];

  const guild = {
    id: '123456789012345678',
    name: 'Rocha Roleplay',
    emojis: { cache: { find: () => null } }
  };
  const user = {
    id: '222222222222222222',
    username: 'previewer',
    globalName: 'Preview User'
  };
  const channel = {
    id: '333333333333333333',
    name: 'config-preview',
    guild
  };

  const payloads = [
    ['preview menu', previewMenu(config)],
    ['public panel', buildPublicPreview(config, guild)],
    ['created ticket', buildCreatedPreview(config, guild, user, channel)],
    ['inside ticket', buildTicketPreview(config, guild, user, channel)],
    ['questionnaire page 1', buildQuestionnairePreview(config, guild, user, 0)],
    ['questionnaire page 2', buildQuestionnairePreview(config, guild, user, 1)],
    ['rating', buildRatingPreview(config, guild, user, channel)],
    ['close', buildClosePreview(config, guild, user, channel)],
    ['logs', buildLogsPreview(config, guild, user, channel)],
    ['presets', buildPresetsPreview(config, guild, user, channel)]
  ];

  for (const [name, payload] of payloads) validate(name, payload);

  const publicPreview = buildPublicPreview(config, guild);
  for (const row of publicPreview.components) {
    for (const component of json(row).components || []) assert.equal(component.disabled, true, 'painel público: componente deveria estar desativado');
  }

  const questionnaire = buildQuestionnairePreview(config, guild, user, 0);
  const qComponents = (questionnaire.components || []).flatMap(row => json(row).components || []);
  const qIds = qComponents.map(component => component.custom_id).filter(Boolean);
  assert.ok(qIds.some(id => id.startsWith('configx:preview:qpage:')), 'questionário: navegação de prévia não encontrada');
  for (const component of qComponents.filter(component => component.custom_id?.startsWith('q:answer:'))) {
    assert.equal(component.disabled, true, 'questionário: botão real de resposta deve permanecer desativado na prévia');
  }

  console.log('✅ Rocha Ticket preview self-test concluído sem erros.');
}

run();
