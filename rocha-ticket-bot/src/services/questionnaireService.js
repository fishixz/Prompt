const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { getGuildConfig, getState, mutate } = require('../database/store');
const { colorInt, truncate } = require('../utils/discord');

function responseKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

async function hasCompletedQuestionnaire(guildId, userId) {
  const config = await getGuildConfig(guildId);
  if (!config.questionnaire.enabled || !config.questionnaire.requiredBeforeTicket) return true;
  const db = await getState();
  const response = db.questionnaireResponses[responseKey(guildId, userId)];
  return Boolean(response && response.version === config.questionnaire.version);
}

async function beginQuestionnaire(guildId, userId, typeId) {
  const config = await getGuildConfig(guildId);
  await mutate(db => {
    db.pendingQuestionnaires[responseKey(guildId, userId)] = {
      guildId,
      userId,
      typeId,
      page: 0,
      answers: {},
      startedAt: new Date().toISOString()
    };
  });
  return renderQuestionnaire(config, await getPending(guildId, userId));
}

async function getPending(guildId, userId) {
  const db = await getState();
  return db.pendingQuestionnaires[responseKey(guildId, userId)] || null;
}

async function setPage(guildId, userId, page) {
  return mutate(db => {
    const pending = db.pendingQuestionnaires[responseKey(guildId, userId)];
    if (!pending) return null;
    pending.page = page;
    return pending;
  });
}

async function setAnswer(guildId, userId, questionId, answer) {
  return mutate(db => {
    const pending = db.pendingQuestionnaires[responseKey(guildId, userId)];
    if (!pending) return null;
    pending.answers[questionId] = answer;
    return pending;
  });
}

function renderQuestionnaire(config, pending) {
  const questions = config.questionnaire.questions || [];
  if (!pending || !questions.length) {
    const embed = new EmbedBuilder().setColor(colorInt(config.branding.color)).setTitle('⚠️ Questionário indisponível').setDescription('O questionário ainda não possui perguntas configuradas. Avise a administração.');
    return { embeds: [embed], components: [], ephemeral: true };
  }
  const page = Math.max(0, Math.min(pending.page || 0, questions.length - 1));
  const q = questions[page];
  const answer = pending.answers[q.id];
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle(config.questionnaire.title || '📊 Questionário obrigatório')
    .setDescription(`${page === 0 ? `${config.questionnaire.intro}\n\n` : ''}**${page + 1}. ${q.text}**\n${q.description ? `${q.description}\n` : ''}\n${q.required ? '🔒 Resposta obrigatória' : '🟢 Resposta opcional'}\n\n**Resposta atual:** ${answer ? `\`${truncate(answer, 500)}\`` : '_ainda não respondida_'}\n\nPágina **${page + 1}/${questions.length}**`);

  const rows = [];
  if (q.kind === 'single') {
    const options = (q.options || []).slice(0, 15);
    for (let i = 0; i < options.length; i += 5) {
      const row = new ActionRowBuilder();
      for (let j = i; j < Math.min(i + 5, options.length); j++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`q:answer:${q.id}:${j}`)
            .setLabel(truncate(options[j], 80))
            .setStyle(answer === options[j] ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(answer === options[j] ? '✅' : '☑️')
        );
      }
      rows.push(row);
    }
  } else {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`q:text:${q.id}`).setLabel(answer ? 'Editar resposta' : 'Responder').setEmoji('✍️').setStyle(ButtonStyle.Primary)
    ));
  }

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`q:page:${Math.max(0, page - 1)}`).setLabel('Anterior').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId('q:noop').setLabel(`Página ${page + 1}/${questions.length}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    page < questions.length - 1
      ? new ButtonBuilder().setCustomId(`q:page:${page + 1}`).setLabel('Próxima').setEmoji('▶️').setStyle(ButtonStyle.Primary)
      : new ButtonBuilder().setCustomId('q:finish').setLabel('JÁ RESPONDI, FINALIZAR ENVIO!').setEmoji('✅').setStyle(ButtonStyle.Success)
  );
  if (rows.length < 5) rows.push(nav);
  return { embeds: [embed], components: rows.slice(0, 5), ephemeral: true };
}

async function finishQuestionnaire(guildId, userId) {
  const config = await getGuildConfig(guildId);
  const pending = await getPending(guildId, userId);
  if (!pending) return { ok: false, error: 'Seu questionário expirou. Selecione o tipo de ticket novamente.' };
  const missing = (config.questionnaire.questions || []).filter(q => q.required && !String(pending.answers[q.id] || '').trim());
  if (missing.length) return { ok: false, error: `Responda primeiro: ${missing.map(q => `**${q.text}**`).join(', ')}` };

  const completed = {
    guildId,
    userId,
    version: config.questionnaire.version,
    answers: pending.answers,
    completedAt: new Date().toISOString()
  };
  await mutate(db => {
    db.questionnaireResponses[responseKey(guildId, userId)] = completed;
    delete db.pendingQuestionnaires[responseKey(guildId, userId)];
  });
  return { ok: true, response: completed, typeId: pending.typeId };
}

async function sendQuestionnaireResponse(guild, user, response) {
  const config = await getGuildConfig(guild.id);
  const channelId = config.questionnaire.responseChannelId || config.logs.events.questionnaire || config.logs.defaultChannelId;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const fields = (config.questionnaire.questions || []).map(q => ({
    name: truncate(q.text, 256),
    value: truncate(response.answers[q.id] || '_sem resposta_', 1024),
    inline: false
  })).slice(0, 25);
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle('📊 Novo questionário respondido')
    .setDescription(`**Usuário:** ${user} • \`${user.id}\`\n**Versão:** \`${response.version}\``)
    .addFields(fields)
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(console.error);
}

module.exports = {
  responseKey,
  hasCompletedQuestionnaire,
  beginQuestionnaire,
  getPending,
  setPage,
  setAnswer,
  renderQuestionnaire,
  finishQuestionnaire,
  sendQuestionnaireResponse
};
