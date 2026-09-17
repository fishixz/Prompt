const { EmbedBuilder, MessageFlags } = require('discord.js');
const { getGuildConfig, saveGuildConfig } = require('../database/store');
const { canConfigure } = require('../utils/permissions');
const { recomputeSetup } = require('../services/configService');
const { runDiagnostics } = require('../services/diagnosticService');
const { consumeCooldown } = require('../services/securityService');
const { configHome } = require('../panels/configPanel');
const { panelMessage } = require('../panels/ticketPanel');
const { handleConfigComponent, handleConfigModal } = require('./configHandlers');
const { handleQuestionnaireComponent, handleQuestionnaireModal } = require('./questionnaireHandlers');
const { handleTicketCreateSelect, handleTicketButton, handleTicketSelect, handleTicketModal } = require('./ticketHandlers');
const { handleRatingButton, handleRatingModal } = require('./ratingHandlers');

function asEphemeral(payload) {
  const clean = { ...payload };
  delete clean.ephemeral;
  delete clean.flags;
  return { ...clean, flags: MessageFlags.Ephemeral };
}

async function deny(interaction) {
  const payload = { content: '❌ Você não possui permissão para usar essa configuração.', flags: MessageFlags.Ephemeral };
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(() => null);
  return interaction.reply(payload).catch(() => null);
}

async function openConfig(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: 'Use este comando dentro de um servidor.', flags: MessageFlags.Ephemeral });
  if (!await canConfigure(interaction)) return deny(interaction);
  const { config, validation } = await recomputeSetup(interaction.guild);
  return interaction.reply(asEphemeral(configHome(config, validation)));
}

async function publishPanel(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: 'Use este comando dentro de um servidor.', flags: MessageFlags.Ephemeral });
  if (!await canConfigure(interaction)) return deny(interaction);

  const { config, validation } = await recomputeSetup(interaction.guild);
  if (!validation.ok) {
    const view = configHome(config, validation);
    view.content = '⚠️ O `/painel` só será liberado quando os itens obrigatórios estiverem válidos.';
    return interaction.reply(asEphemeral(view));
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const channel = interaction.guild.channels.cache.get(config.panel.channelId)
    || await interaction.guild.channels.fetch(config.panel.channelId).catch(() => null);
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

function diagnosticField(items, emptyText, limit = 10) {
  if (!items.length) return emptyText;
  const visible = items.slice(0, limit).map(item => `• ${item}`).join('\n');
  return items.length > limit ? `${visible}\n• ... e mais ${items.length - limit}`.slice(0, 1024) : visible.slice(0, 1024);
}

async function openDiagnostics(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: 'Use este comando dentro de um servidor.', flags: MessageFlags.Ephemeral });
  if (!await canConfigure(interaction)) return deny(interaction);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const report = await runDiagnostics(interaction.guild, interaction.client);
  const healthy = report.errors.length === 0;
  const embed = new EmbedBuilder()
    .setColor(healthy ? 0x20bf6b : 0xe74c3c)
    .setTitle(healthy ? '✅ Diagnóstico • Rocha Ticket' : '⚠️ Diagnóstico • Rocha Ticket')
    .setDescription([
      `**Erros:** ${report.errors.length}`,
      `**Avisos:** ${report.warnings.length}`,
      `**Verificações OK:** ${report.ok.length}`,
      '',
      `**Tickets:** ${report.stats.totalTickets} no histórico • ${report.stats.activeTickets} ativos`,
      `**Questionários respondidos:** ${report.stats.questionnaireResponses}`,
      `**Avaliações registradas:** ${report.stats.ratings}`
    ].join('\n'))
    .addFields(
      { name: '❌ Erros', value: diagnosticField(report.errors, 'Nenhum erro detectado.'), inline: false },
      { name: '⚠️ Avisos', value: diagnosticField(report.warnings, 'Nenhum aviso.'), inline: false },
      { name: '✅ Verificações', value: diagnosticField(report.ok, 'Nenhuma verificação positiva registrada.'), inline: false }
    )
    .setFooter({ text: 'Execute novamente após alterar a configuração.' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function interactionCreate(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'config') return openConfig(interaction);
      if (interaction.commandName === 'painel') return publishPanel(interaction);
      if (interaction.commandName === 'diagnostico') return openDiagnostics(interaction);
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
      const config = await getGuildConfig(interaction.guildId);
      const cooldown = await consumeCooldown(
        interaction.guildId,
        interaction.user.id,
        'ticket-create',
        config.security.cooldownSeconds
      );
      if (!cooldown.allowed) {
        const seconds = Math.max(1, Math.ceil(cooldown.retryAfterMs / 1000));
        return interaction.reply({
          content: `⏳ Aguarde **${seconds}s** antes de tentar abrir outro atendimento.`,
          flags: MessageFlags.Ephemeral
        });
      }
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
    if (interaction.replied) return interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
    return interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
  }
}

module.exports = {
  interactionCreate,
  openConfig,
  publishPanel,
  openDiagnostics
};
