const { getGuildConfig, saveGuildConfig } = require('../database/store');
const { canConfigure } = require('../utils/permissions');
const { validateConfiguration, recomputeSetup } = require('../services/configService');
const { configHome } = require('../panels/configPanel');
const { panelMessage } = require('../panels/ticketPanel');
const { handleConfigComponent, handleConfigModal } = require('./configHandlers');
const { handleQuestionnaireComponent, handleQuestionnaireModal } = require('./questionnaireHandlers');
const { handleTicketCreateSelect, handleTicketButton, handleTicketSelect, handleTicketModal } = require('./ticketHandlers');
const { handleRatingButton, handleRatingModal } = require('./ratingHandlers');

async function deny(interaction) {
  const payload = { content: '❌ Você não possui permissão para usar essa configuração.', ephemeral: true };
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(() => null);
  return interaction.reply(payload).catch(() => null);
}

async function openConfig(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: 'Use este comando dentro de um servidor.', ephemeral: true });
  if (!await canConfigure(interaction)) return deny(interaction);
  const { config, validation } = await recomputeSetup(interaction.guild);
  return interaction.reply(configHome(config, validation));
}

async function publishPanel(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: 'Use este comando dentro de um servidor.', ephemeral: true });
  if (!await canConfigure(interaction)) return deny(interaction);

  const { config, validation } = await recomputeSetup(interaction.guild);
  if (!validation.ok) {
    const view = configHome(config, validation);
    view.content = '⚠️ O `/painel` só será liberado quando os itens obrigatórios estiverem válidos.';
    return interaction.reply(view);
  }

  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.guild.channels.cache.get(config.panel.channelId) || await interaction.guild.channels.fetch(config.panel.channelId).catch(() => null);
  if (!channel?.isTextBased()) return interaction.editReply('❌ O canal do painel não existe mais. Abra `/config`.');

  const payload = panelMessage(config, interaction.guild);
  let message = null;
  if (config.panel.messageId) {
    message = await channel.messages.fetch(config.panel.messageId).catch(() => null);
    if (message) await message.edit(payload);
  }
  if (!message) message = await channel.send(payload);
  config.panel.messageId = message.id;
  config.setupComplete = true;
  await saveGuildConfig(interaction.guildId, config);

  return interaction.editReply(`✅ Painel publicado/atualizado em ${channel}: https://discord.com/channels/${interaction.guildId}/${channel.id}/${message.id}`);
}

async function interactionCreate(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'config') return openConfig(interaction);
      if (interaction.commandName === 'painel') return publishPanel(interaction);
      return;
    }

    if (interaction.customId?.startsWith('config:')) {
      if (!interaction.inGuild()) return deny(interaction);
      if (!await canConfigure(interaction)) return deny(interaction);
      if (interaction.isModalSubmit()) return handleConfigModal(interaction);
      return handleConfigComponent(interaction);
    }

    if (interaction.customId?.startsWith('q:')) {
      if (interaction.isModalSubmit()) return handleQuestionnaireModal(interaction);
      return handleQuestionnaireComponent(interaction);
    }

    if (interaction.customId?.startsWith('rating:')) {
      if (interaction.isModalSubmit()) return handleRatingModal(interaction);
      if (interaction.isButton()) return handleRatingButton(interaction);
    }

    if (interaction.customId?.startsWith('ticket:create:') && interaction.isStringSelectMenu()) {
      return handleTicketCreateSelect(interaction);
    }

    if (interaction.customId?.startsWith('ticket:')) {
      if (interaction.isModalSubmit()) return handleTicketModal(interaction);
      if (interaction.isAnySelectMenu()) return handleTicketSelect(interaction);
      if (interaction.isButton()) return handleTicketButton(interaction);
    }
  } catch (error) {
    console.error('Interaction error:', error);
    const content = `❌ Ocorreu um erro ao processar esta ação.\n\`${String(error.message || error).slice(0, 1500)}\``;
    if (interaction.deferred) return interaction.editReply({ content }).catch(() => null);
    if (interaction.replied) return interaction.followUp({ content, ephemeral: true }).catch(() => null);
    return interaction.reply({ content, ephemeral: true }).catch(() => null);
  }
}

module.exports = { interactionCreate, openConfig, publishPanel };
