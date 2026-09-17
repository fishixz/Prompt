const {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { getGuildConfig } = require('../database/store');
const {
  getPending,
  setPage,
  setAnswer,
  renderQuestionnaire,
  finishQuestionnaire,
  sendQuestionnaireResponse
} = require('../services/questionnaireService');
const { createTicket } = require('../services/ticketService');
const { ticketCreatedEphemeral } = require('../panels/ticketPanel');

const EPHEMERAL = MessageFlags.Ephemeral;

function updatePayload(payload) {
  const clean = { ...payload };
  delete clean.ephemeral;
  delete clean.flags;
  return clean;
}

function privatePayload(payload) {
  return { ...updatePayload(payload), flags: EPHEMERAL };
}

async function handleQuestionnaireComponent(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('q:')) return false;
  const config = await getGuildConfig(interaction.guildId);
  const pending = await getPending(interaction.guildId, interaction.user.id);
  if (!pending) {
    return interaction.reply({
      content: '⚠️ Esse questionário expirou. Volte ao painel e selecione o tipo de ticket novamente.',
      flags: EPHEMERAL
    });
  }

  if (id === 'q:noop') return interaction.deferUpdate();

  if (id.startsWith('q:page:')) {
    const page = Number(id.split(':').pop()) || 0;
    const updated = await setPage(interaction.guildId, interaction.user.id, page);
    return interaction.update(updatePayload(renderQuestionnaire(config, updated)));
  }

  if (id.startsWith('q:answer:')) {
    const [, , questionId, rawIndex] = id.split(':');
    const question = config.questionnaire.questions.find(x => x.id === questionId);
    if (!question || question.kind !== 'single') {
      return interaction.reply({ content: 'Pergunta inválida.', flags: EPHEMERAL });
    }
    const option = question.options[Number(rawIndex)];
    if (option == null) return interaction.reply({ content: 'Opção inválida.', flags: EPHEMERAL });
    const updated = await setAnswer(interaction.guildId, interaction.user.id, questionId, option);
    return interaction.update(updatePayload(renderQuestionnaire(config, updated)));
  }

  if (id.startsWith('q:text:')) {
    const questionId = id.split(':').pop();
    const question = config.questionnaire.questions.find(x => x.id === questionId);
    if (!question) return interaction.reply({ content: 'Pergunta inválida.', flags: EPHEMERAL });
    const current = pending.answers[questionId] || '';
    const input = new TextInputBuilder()
      .setCustomId('answer')
      .setLabel('Sua resposta')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(question.required !== false)
      .setMaxLength(1500);
    if (current) input.setValue(String(current).slice(0, 1500));
    const modal = new ModalBuilder()
      .setCustomId(`q:submit:${questionId}`)
      .setTitle('Responder questionário')
      .addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (id === 'q:finish') {
    const result = await finishQuestionnaire(interaction.guildId, interaction.user.id);
    if (!result.ok) return interaction.reply({ content: `⚠️ ${result.error}`, flags: EPHEMERAL });
    await sendQuestionnaireResponse(interaction.guild, interaction.user, result.response);
    try {
      const created = await createTicket(interaction.guild, interaction.user, result.typeId);
      return interaction.update(updatePayload(ticketCreatedEphemeral(config, created.ticket, created.channel, created.type)));
    } catch (error) {
      return interaction.update({
        content: `❌ Questionário salvo, mas não consegui criar o ticket: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  return false;
}

async function handleQuestionnaireModal(interaction) {
  if (!interaction.customId.startsWith('q:submit:')) return false;
  const questionId = interaction.customId.split(':').pop();
  const config = await getGuildConfig(interaction.guildId);
  const question = config.questionnaire.questions.find(x => x.id === questionId);
  if (!question) return interaction.reply({ content: 'Pergunta não encontrada.', flags: EPHEMERAL });

  const answer = interaction.fields.getTextInputValue('answer').trim();
  const updated = await setAnswer(interaction.guildId, interaction.user.id, questionId, answer);
  if (!updated) {
    return interaction.reply({ content: 'Esse questionário expirou. Selecione novamente no painel.', flags: EPHEMERAL });
  }

  const payload = updatePayload(renderQuestionnaire(config, updated));
  // Modais abertos a partir da mensagem do questionário podem atualizar a própria mensagem,
  // evitando acumular várias respostas efêmeras na tela.
  if (typeof interaction.isFromMessage === 'function' && interaction.isFromMessage()) {
    return interaction.update(payload);
  }
  return interaction.reply(privatePayload({ ...payload, content: '✅ Resposta salva.' }));
}

module.exports = { handleQuestionnaireComponent, handleQuestionnaireModal };
