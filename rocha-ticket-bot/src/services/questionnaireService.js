const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { getGuildConfig, getState, mutate } = require('../database/store');
const { colorInt, truncate } = require('../utils/discord');

const PENDING_TTL_MS = 2 * 60 * 60 * 1000;

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
  const key = responseKey(guildId, userId);
  const db = await getState();
  const pending = db.pendingQuestionnaires[key] || null;
  if (!pending) return null;

  const started = new Date(pending.startedAt || 0).getTime();
  if (!Number.isFinite(started) || Date.now() - started > PENDING_TTL_MS) {
    await mutate(state => { delete state.pendingQuestionnaires[key]; });
    return null;
  }
  return pending;
}

async function setPage(guildId, userId, page) {
  const pending = await getPending(guildId, userId);
  if (!pending) return null;
  return mutate(db => {
    const current = db.pendingQuestionnaires[responseKey(guildId, userId)];
    if (!current) return null;
    current.page = Math.max(0, Number(page) || 0);
    return current;
  });
}

async function setAnswer(guildId, userId, questionId, answer) {
  const pending = await getPending(guildId, userId);
  if (!pending) return null;
  return mutate(db => {
    const current = db.pendingQuestionnaires[responseKey(guildId, userId)];
    if (!current) return null;
    current.answers[questionId] = answer;
    return current;
  });
}

function renderQuestionnaire(config, pending) {
  const questions = config.questionnaire.questions || [];
  if (!pending || !questions.length) {
    const embed = new EmbedBuilder()
      .setColor(colorInt(config.branding.color))
      .setTitle('⚠️ Questionário indisponível')
      .setDescription('O questionário ainda não possui perguntas configuradas. Avise a administração.');
    return { embeds: [embed], components: [], ephemeral: true };
  }

  const page = Math.max(0, Math.min(pending.page || 0, questions.length - 1));
  const question = questions[page];
  const answer = pending.answers[question.id];
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle(config.questionnaire.title || '📊 Questionário obrigatório')
    .setDescription(`${page === 0 ? `${config.questionnaire.intro}\n\n` : ''}**${page + 1}. ${question.text}**\n${question.description ? `${question.description}\n` : ''}\n${question.required ? '🔒 Resposta obrigatória' : '🟢 Resposta opcional'}\n\n**Resposta atual:** ${answer ? `\`${truncate(answer, 500)}\`` : '_ainda não respondida_'}\n\nPágina **${page + 1}/${questions.length}**`);

  const rows = [];
  if (question.kind === 'single') {
    const options = (question.options || []).slice(0, 15);
    for (let i = 0; i < options.length; i += 5) {
      const row = new ActionRowBuilder();
      for (let j = i; j < Math.min(i + 5, options.length); j++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`q:answer:${question.id}:${j}`)
            .setLabel(truncate(options[j], 80))
            .setStyle(answer === options[j] ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(answer === options[j] ? '✅' : '☑️')
        );
      }
      rows.push(row);
    }
  } else {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`q:text:${question.id}`)
        .setLabel(answer ? 'Editar resposta' : 'Responder')
        .setEmoji('✍️')
        .setStyle(ButtonStyle.Primary)
    ));
  }

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`q:page:${Math.max(0, page - 1)}`)
      .setLabel('Anterior')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('q:noop')
      .setLabel(`Página ${page + 1}/${questions.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
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
  if (missing.length) {
    return { ok: false, error: `Responda primeiro: ${missing.map(q => `**${q.text}**`).join(', ')}` };
  }

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

  const allFields = (config.questionnaire.questions || []).map(question => ({
    name: truncate(question.text, 256),
    value: truncate(response.answers[question.id] || '_sem resposta_', 1024),
    inline: false
  }));

  const embeds = [];
  const chunks = [];
  for (let i = 0; i < allFields.length; i += 25) chunks.push(allFields.slice(i, i + 25));
  if (!chunks.length) chunks.push([]);

  for (let index = 0; index < chunks.length; index++) {
    const embed = new EmbedBuilder()
      .setColor(colorInt(config.branding.color))
      .setTitle(index === 0 ? '📊 Novo questionário respondido' : `📊 Questionário • continuação ${index + 1}/${chunks.length}`)
      .setDescription(index === 0 ? `**Usuário:** ${user} • \`${user.id}\`\n**Versão:** \`${response.version}\`` : `Continuação das respostas de ${user}.`)
      .setTimestamp();
    if (chunks[index].length) embed.addFields(chunks[index]);
    embeds.push(embed);
  }

  // Discord aceita no máximo 10 embeds por mensagem; divide quando necessário.
  for (let i = 0; i < embeds.length; i += 10) {
    await channel.send({ embeds: embeds.slice(i, i + 10) }).catch(console.error);
  }
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
