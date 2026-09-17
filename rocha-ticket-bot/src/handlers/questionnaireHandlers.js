const {
  ActionRowBuilder,
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

function updatePayload(payload) { const p = { ...payload }; delete p.ephemeral; return p; }

async function handleQuestionnaireComponent(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('q:')) return false;
  const config = await getGuildConfig(interaction.guildId);
  const pending = await getPending(interaction.guildId, interaction.user.id);
  if (!pending) {
    return interaction.reply({ content: '⚠️ Esse questionário expirou. Volte ao painel e selecione o tipo de ticket novamente.', ephemeral: true });
  }

  if (id === 'q:noop') return interaction.deferUpdate();
  if (id.startsWith('q:page:')) {
    const page = Number(id.split(':').pop()) || 0;
    const updated = await setPage(interaction.guildId, interaction.user.id, page);
    return interaction.update(updatePayload(renderQuestionnaire(config, updated)));
  }
  if (id.startsWith('q:answer:')) {
    const [, , questionId, rawIndex] = id.split(':');
    const q = config.questionnaire.questions.find(x => x.id === questionId);
    if (!q || q.kind !== 'single') return interaction.reply({ content: 'Pergunta inválida.', ephemeral: true });
    const option = q.options[Number(rawIndex)];
    if (option == null) return interaction.reply({ content: 'Opção inválida.', ephemeral: true });
    const updated = await setAnswer(interaction.guildId, interaction.user.id, questionId, option);
    return interaction.update(updatePayload(renderQuestionnaire(config, updated)));
  }
  if (id.startsWith('q:text:')) {
    const questionId = id.split(':').pop();
    const q = config.questionnaire.questions.find(x => x.id === questionId);
    if (!q) return interaction.reply({ content: 'Pergunta inválida.', ephemeral: true });
    const current = pending.answers[questionId] || '';
    const input = new TextInputBuilder()
      .setCustomId('answer')
      .setLabel('Sua resposta')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(q.required !== false)
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
    if (!result.ok) return interaction.reply({ content: `⚠️ ${result.error}`, ephemeral: true });
    await sendQuestionnaireResponse(interaction.guild, interaction.user, result.response);
    try {
      const created = await createTicket(interaction.guild, interaction.user, result.typeId);
      return interaction.update(updatePayload(ticketCreatedEphemeral(config, created.ticket, created.channel, created.type)));
    } catch (error) {
      return interaction.update({ content: `❌ Questionário salvo, mas não consegui criar o ticket: ${error.message}`, embeds: [], components: [] });
    }
  }
  return false;
}

async function handleQuestionnaireModal(interaction) {
  if (!interaction.customId.startsWith('q:submit:')) return false;
  const questionId = interaction.customId.split(':').pop();
  const config = await getGuildConfig(interaction.guildId);
  const q = config.questionnaire.questions.find(x => x.id === questionId);
  if (!q) return interaction.reply({ content: 'Pergunta não encontrada.', ephemeral: true });
  const answer = interaction.fields.getTextInputValue('answer').trim();
  const updated = await setAnswer(interaction.guildId, interaction.user.id, questionId, answer);
  if (!updated) return interaction.reply({ content: 'Esse questionário expirou. Selecione novamente no painel.', ephemeral: true });
  return interaction.reply({ ...renderQuestionnaire(config, updated), content: '✅ Resposta salva.', ephemeral: true });
}

module.exports = { handleQuestionnaireComponent, handleQuestionnaireModal };
