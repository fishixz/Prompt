const assert = require('node:assert/strict');
const { defaultGuildConfig } = require('../config/defaultConfig');
const views = require('../panels/configPanel');
const { panelMessage, ticketOpeningMessages, ticketCreatedEphemeral } = require('../panels/ticketPanel');
const { duplicatedCustomIds } = require('../services/diagnosticService');
const { renderQuestionnaire } = require('../services/questionnaireService');
const { buildRatingPayload } = require('../services/ratingService');
const { buildPresetPage } = require('../services/ticketPresetService');
const { selectorAssignmentPayload } = require('../handlers/configExtensionHandlers');
const { renderChannelName, renderTemplate, buildVariables } = require('../utils/variables');

function componentJson(component) {
  return typeof component?.toJSON === 'function' ? component.toJSON() : component;
}

function validatePayload(name, payload) {
  const rows = payload?.components || [];
  assert.ok(rows.length <= 5, `${name}: mais de 5 ActionRows (${rows.length})`);

  const duplicates = duplicatedCustomIds(payload);
  assert.deepEqual(duplicates, [], `${name}: custom_id duplicado: ${duplicates.join(', ')}`);

  for (const row of rows) {
    const json = componentJson(row);
    assert.ok((json.components || []).length <= 5, `${name}: uma ActionRow possui mais de 5 componentes`);
    for (const component of json.components || []) {
      if (component.type === 3) {
        assert.ok(component.options?.length >= 1, `${name}: StringSelect sem opções`);
        assert.ok(component.options.length <= 25, `${name}: StringSelect com mais de 25 opções`);
      }
      if (component.custom_id) {
        assert.ok(component.custom_id.length <= 100, `${name}: custom_id maior que 100 caracteres`);
      }
    }
  }
}

function buildFixture(typeCount = 12) {
  const config = defaultGuildConfig('123456789012345678');
  config.permissions.adminRoleIds = ['100000000000000001'];
  config.permissions.staffRoleIds = ['100000000000000002'];
  config.panel.channelId = '100000000000000003';
  config.questionnaire.questions = [
    {
      id: 'q_source',
      text: 'Como conheceu o Rocha Roleplay?',
      description: 'Escolha uma opção.',
      kind: 'single',
      options: ['TikTok', 'Instagram', 'YouTube'],
      required: true
    },
    {
      id: 'q_reason',
      text: 'Explique o motivo do contato.',
      description: 'Escreva os detalhes.',
      kind: 'text',
      options: [],
      required: true
    }
  ];
  config.ticketTypes = Array.from({ length: typeCount }, (_, index) => ({
    id: `tipo-${index + 1}`,
    name: `Tipo ${index + 1}`,
    description: `Atendimento ${index + 1}`,
    emoji: '🎫',
    enabled: true,
    selectorId: 'principal',
    parentCategoryId: '100000000000000004',
    channelNameTemplate: 'ticket-{ticket_type_slug}-{ticket_id}',
    staffRoleIds: [],
    requireQuestionnaire: true,
    logChannelId: null,
    logChannelIds: {}
  }));
  return config;
}

function fakeGuild() {
  return {
    id: '123456789012345678',
    name: 'Rocha Roleplay',
    emojis: { cache: { find: () => null } }
  };
}

function run() {
  const config = buildFixture();
  const validation = { ok: false, missing: ['Teste'], warnings: [] };

  const payloads = [
    ['configHome', views.configHome(config, validation)],
    ['permissionsPanel', views.permissionsPanel(config)],
    ['panelSettings', views.panelSettings(config)],
    ['selectorsPanel', views.selectorsPanel(config)],
    ['ticketTypesPanel page 1', views.ticketTypesPanel(config, 0)],
    ['ticketTypesPanel page 2', views.ticketTypesPanel(config, 1)],
    ['typePicker', views.typePicker(config, 'open', 0)],
    ['ticketTypeEditor', views.ticketTypeEditor(config, config.ticketTypes[0])],
    ['questionnairePanel', views.questionnairePanel(config)],
    ['logsPanel', views.logsPanel(config)],
    ['ratingPanel', views.ratingPanel(config)],
    ['templatesPanel', views.templatesPanel(config)],
    ['presetsPanel', views.presetsPanel(config)],
    ['securityPanel', views.securityPanel(config)],
    ['variablesPanel', views.variablesPanel(config)],
    ['backupPanel', views.backupPanel(config, validation)],
    ['public panel', panelMessage(config, fakeGuild())]
  ];

  for (const [name, payload] of payloads) validatePayload(name, payload);

  const onePage = buildFixture(1);
  validatePayload('ticketTypesPanel single page', views.ticketTypesPanel(onePage, 0));

  const manyTypes = buildFixture(55);
  validatePayload('typePicker 1/3', views.typePicker(manyTypes, 'open', 0));
  validatePayload('typePicker 2/3', views.typePicker(manyTypes, 'open', 1));
  validatePayload('typePicker 3/3', views.typePicker(manyTypes, 'open', 2));

  const manySelectors = buildFixture(1);
  manySelectors.panel.selectors = Array.from({ length: 52 }, (_, index) => ({
    id: `seletor-${index + 1}`,
    name: `Seletor ${index + 1}`,
    placeholder: `Selecionar ${index + 1}`,
    enabled: true
  }));
  manySelectors.ticketTypes[0].selectorId = 'seletor-1';
  validatePayload('selector assignment 1/3', selectorAssignmentPayload(manySelectors, 'tipo-1', 0));
  validatePayload('selector assignment 2/3', selectorAssignmentPayload(manySelectors, 'tipo-1', 1));
  validatePayload('selector assignment 3/3', selectorAssignmentPayload(manySelectors, 'tipo-1', 2));

  const manyPresets = buildFixture(1);
  manyPresets.presets.moderation = Array.from({ length: 57 }, (_, index) => ({
    id: `preset-${index + 1}`,
    label: `Preset ${index + 1}`,
    text: `Mensagem do preset ${index + 1}`
  }));
  validatePayload('ticket presets 1/3', buildPresetPage(manyPresets, 't_test', 'moderation', 0));
  validatePayload('ticket presets 2/3', buildPresetPage(manyPresets, 't_test', 'moderation', 1));
  validatePayload('ticket presets 3/3', buildPresetPage(manyPresets, 't_test', 'moderation', 2));

  const pendingSingle = {
    guildId: fakeGuild().id,
    userId: '300',
    typeId: 'tipo-1',
    page: 0,
    answers: {},
    startedAt: new Date().toISOString()
  };
  validatePayload('questionnaire single', renderQuestionnaire(config, pendingSingle));
  validatePayload('questionnaire text', renderQuestionnaire(config, { ...pendingSingle, page: 1 }));

  const fakeChannel = { id: '200', name: 'ticket-suporte-0001', guild: fakeGuild() };
  const fakeUser = { id: '300', username: 'tester', globalName: 'Tester' };
  const fakeTicket = {
    uid: 't_test',
    number: 1,
    guildId: fakeGuild().id,
    userId: '300',
    userName: 'tester',
    userDisplay: 'Tester',
    typeId: 'tipo-1',
    typeName: 'Tipo 1',
    createdAt: new Date().toISOString()
  };

  validatePayload('ticket created ephemeral', ticketCreatedEphemeral(config, fakeTicket, fakeChannel, config.ticketTypes[0]));
  for (const [index, payload] of ticketOpeningMessages(config, fakeTicket, config.ticketTypes[0], fakeChannel, fakeUser).entries()) {
    validatePayload(`ticket opening ${index + 1}`, payload);
  }
  validatePayload('rating payload', buildRatingPayload(config, fakeGuild(), fakeTicket, config.ticketTypes[0]));

  assert.equal(renderChannelName('ticket-{ticket_type_slug}-{ticket_id}', { ticket_type_slug: 'suporte', ticket_id: '0001' }), 'ticket-suporte-0001');
  assert.equal(renderTemplate('Olá {user_name}', { user_name: 'Edy' }), 'Olá Edy');

  const vars = buildVariables({ guild: fakeGuild(), ticket: fakeTicket, config });
  assert.equal(vars.user_name, 'tester');
  assert.equal(vars.user_display, 'Tester');
  assert.equal(vars.user_mention, '<@300>');
  assert.equal(vars.rating_scale, '5');

  console.log('✅ Rocha Ticket self-test concluído sem erros.');
}

run();
