const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { getGuildConfig, saveGuildConfig, backupString } = require('../database/store');
const { getTicketType, recomputeSetup } = require('../services/configService');
const { syncStaffRolePermissions } = require('../services/permissionSyncService');
const { createRollingBackup } = require('../services/backupService');
const views = require('../panels/configPanel');
const { colorInt, truncate } = require('../utils/discord');

const EPHEMERAL = MessageFlags.Ephemeral;
const PAGE_SIZE = 25;

function cleanUpdatePayload(payload) {
  const clean = { ...payload };
  delete clean.ephemeral;
  delete clean.flags;
  return clean;
}

function advancedStatusPanel(config, validation = null) {
  const setup = validation?.ok ?? config.setupComplete;
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle('💾 Backup, Status e Configurações Avançadas')
    .setDescription([
      `**Setup:** ${setup ? '✅ válido' : '⚠️ incompleto'}`,
      `**Tipos de ticket:** ${config.ticketTypes?.length || 0}`,
      `**Seletores:** ${config.panel?.selectors?.length || 0}`,
      `**Perguntas:** ${config.questionnaire?.questions?.length || 0}`,
      '',
      `**Questionário obrigatório global:** ${config.questionnaire?.requiredBeforeTicket ? '✅' : '⛔'}`,
      `**/config liberado antes de definir administradores:** ${config.security?.allowConfigBeforeSetupForEveryone ? '✅' : '⛔'}`,
      `**Usuário sair mantém ticket aberto:** ${config.ticket?.userExitKeepsOpen !== false ? '✅ (comportamento do Rocha)' : '⛔'}`,
      `**Template do título do painel:** \`${truncate(config.panel?.titleTemplate || '{logo} {panel_title}', 150)}\``,
      '',
      'Backups automáticos são mantidos localmente em `data/backups/`. O banco também possui recuperação automática caso o JSON principal seja corrompido.'
    ].join('\n'))
    .setTimestamp();

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('configx:backupdownload').setLabel('Baixar backup').setEmoji('⬇️').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('configx:backupnow').setLabel('Criar backup local').setEmoji('💾').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('configx:syncperms').setLabel('Sincronizar permissões').setEmoji('🔐').setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('configx:qrequired')
          .setLabel(config.questionnaire?.requiredBeforeTicket ? 'Questionário não obrigatório' : 'Questionário obrigatório')
          .setEmoji('🧠')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('configx:preconfig')
          .setLabel(config.security?.allowConfigBeforeSetupForEveryone ? 'Restringir pré-config' : 'Liberar pré-config')
          .setEmoji('🛡️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('configx:paneltitle').setLabel('Template do título').setEmoji('🏷️').setStyle(ButtonStyle.Primary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:home').setLabel('Início').setEmoji('🏠').setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

function selectorAssignmentPayload(config, typeId, page = 0) {
  const type = getTicketType(config, typeId);
  if (!type) return null;

  const selectors = (config.panel.selectors || []).filter(selector => selector.enabled);
  const pages = Math.max(1, Math.ceil(selectors.length / PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(Number(page) || 0, pages - 1));
  const slice = selectors.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding.color))
    .setTitle(`📋 Seletor de ${type.name}`)
    .setDescription([
      `**Atual:** ${type.selectorId ? `\`${type.selectorId}\`` : '`não definido`'}`,
      '',
      slice.length ? `Escolha o seletor onde esse tipo deve aparecer. Página **${currentPage + 1}/${pages}**.` : 'Nenhum seletor ativo está disponível.'
    ].join('\n'));

  const rows = [];
  if (slice.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`configx:typeselectorset:${typeId}`)
        .setPlaceholder('Escolha o seletor')
        .addOptions(slice.map(selector => ({
          label: truncate(selector.name, 100),
          value: selector.id,
          description: truncate(selector.placeholder || selector.id, 100),
          default: selector.id === type.selectorId
        })))
    ));
  }

  if (pages > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`configx:typeselectorpage:${typeId}:${currentPage - 1}`)
        .setLabel('Anterior')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 0),
      new ButtonBuilder()
        .setCustomId(`configx:typeselectorpage:${typeId}:${currentPage + 1}`)
        .setLabel('Próxima')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= pages - 1)
    ));
  }

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`configx:typeback:${typeId}`)
      .setLabel('Voltar ao tipo')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
  ));

  return { embeds: [embed], components: rows };
}

async function handleConfigExtension(interaction) {
  const id = interaction.customId || '';
  const config = await getGuildConfig(interaction.guildId);

  if (id === 'config:backup') {
    const { validation } = await recomputeSetup(interaction.guild);
    return interaction.update(advancedStatusPanel(config, validation));
  }

  if (id.startsWith('config:typeselector:')) {
    const typeId = id.split(':').pop();
    const payload = selectorAssignmentPayload(config, typeId, 0);
    if (!payload) return interaction.reply({ content: '❌ Tipo não encontrado.', flags: EPHEMERAL });
    return interaction.reply({ ...payload, flags: EPHEMERAL });
  }

  if (id === 'config:set:staffroles' && interaction.isRoleSelectMenu()) {
    const oldRoles = [...(config.permissions.staffRoleIds || [])];
    config.permissions.staffRoleIds = interaction.values;
    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    await syncStaffRolePermissions(interaction.guild, { roleIdsToRemove: oldRoles });
    return interaction.update(cleanUpdatePayload(views.permissionsPanel(config)));
  }

  if (id.startsWith('config:typeroles:') && interaction.isRoleSelectMenu()) {
    const typeId = id.split(':').pop();
    const type = getTicketType(config, typeId);
    if (!type) return interaction.reply({ content: '❌ Tipo não encontrado.', flags: EPHEMERAL });
    const oldRoles = [...(type.staffRoleIds || [])];
    type.staffRoleIds = interaction.values;
    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    await syncStaffRolePermissions(interaction.guild, { typeId, roleIdsToRemove: oldRoles });
    return interaction.update(cleanUpdatePayload(views.ticketTypeEditor(config, type)));
  }

  if (!id.startsWith('configx:')) return false;

  if (id === 'configx:backupdownload') {
    const json = await backupString();
    const file = new AttachmentBuilder(Buffer.from(json, 'utf8'), { name: `rocha-ticket-backup-${interaction.guildId}.json` });
    return interaction.reply({ content: '💾 Backup atual do banco:', files: [file], flags: EPHEMERAL });
  }

  if (id === 'configx:backupnow') {
    const result = await createRollingBackup({ keep: 7 });
    return interaction.reply({ content: `✅ Backup local criado com sucesso. Mantendo até **${result.kept}** cópia(s).`, flags: EPHEMERAL });
  }

  if (id === 'configx:syncperms') {
    const count = await syncStaffRolePermissions(interaction.guild);
    return interaction.reply({ content: `✅ Permissões sincronizadas em **${count}** ticket(s) deste servidor.`, flags: EPHEMERAL });
  }

  if (id === 'configx:qrequired') {
    config.questionnaire.requiredBeforeTicket = !config.questionnaire.requiredBeforeTicket;
    await saveGuildConfig(interaction.guildId, config);
    const { validation } = await recomputeSetup(interaction.guild);
    return interaction.update(advancedStatusPanel(config, validation));
  }

  if (id === 'configx:preconfig') {
    config.security.allowConfigBeforeSetupForEveryone = !config.security.allowConfigBeforeSetupForEveryone;
    await saveGuildConfig(interaction.guildId, config);
    const { validation } = await recomputeSetup(interaction.guild);
    return interaction.update(advancedStatusPanel(config, validation));
  }

  if (id === 'configx:paneltitle') {
    const input = new TextInputBuilder()
      .setCustomId('value')
      .setLabel('Template do título do painel')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200)
      .setValue(String(config.panel.titleTemplate || '{logo} {panel_title}').slice(0, 200));
    const modal = new ModalBuilder()
      .setCustomId('configx:paneltitlesubmit')
      .setTitle('Template do título')
      .addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (id === 'configx:paneltitlesubmit' && interaction.isModalSubmit()) {
    const value = interaction.fields.getTextInputValue('value').trim();
    if (!value) return interaction.reply({ content: '❌ O template não pode ficar vazio.', flags: EPHEMERAL });
    config.panel.titleTemplate = value;
    await saveGuildConfig(interaction.guildId, config);
    return interaction.reply({ content: '✅ Template do título do painel atualizado.', flags: EPHEMERAL });
  }

  if (id.startsWith('configx:typeselectorpage:')) {
    const [, , typeId, rawPage] = id.split(':');
    const payload = selectorAssignmentPayload(config, typeId, Number(rawPage) || 0);
    if (!payload) return interaction.update({ content: '❌ Tipo não encontrado.', embeds: [], components: [] });
    return interaction.update(payload);
  }

  if (id.startsWith('configx:typeselectorset:') && interaction.isStringSelectMenu()) {
    const typeId = id.split(':').pop();
    const type = getTicketType(config, typeId);
    if (!type) return interaction.update({ content: '❌ Tipo não encontrado.', embeds: [], components: [] });
    const selectorId = interaction.values[0];
    const selector = config.panel.selectors.find(item => item.id === selectorId && item.enabled);
    if (!selector) return interaction.update({ content: '❌ Esse seletor não está mais disponível.', embeds: [], components: [] });

    type.selectorId = selectorId;
    await saveGuildConfig(interaction.guildId, config);
    await recomputeSetup(interaction.guild);
    return interaction.update({
      content: `✅ **${type.name}** agora aparece no seletor **${selector.name}** (\`${selector.id}\`).`,
      embeds: [],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`configx:typeback:${type.id}`).setLabel('Voltar ao tipo').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
      )]
    });
  }

  if (id.startsWith('configx:typeback:')) {
    const typeId = id.split(':').pop();
    const type = getTicketType(config, typeId);
    if (!type) return interaction.update({ content: '❌ Tipo não encontrado.', embeds: [], components: [] });
    return interaction.update(cleanUpdatePayload(views.ticketTypeEditor(config, type)));
  }

  return false;
}

function isConfigExtensionId(id = '') {
  return id === 'config:backup'
    || id.startsWith('configx:')
    || id.startsWith('config:typeselector:')
    || id === 'config:set:staffroles'
    || id.startsWith('config:typeroles:');
}

module.exports = {
  handleConfigExtension,
  isConfigExtensionId,
  selectorAssignmentPayload,
  advancedStatusPanel
};
