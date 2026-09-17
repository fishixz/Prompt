const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder
} = require('discord.js');
const { getGuildConfig, saveGuildConfig } = require('../database/store');
const { getTicketType, recomputeSetup } = require('../services/configService');
const { syncStaffRolePermissions } = require('../services/permissionSyncService');
const views = require('../panels/configPanel');
const { colorInt, truncate } = require('../utils/discord');

const EPHEMERAL = MessageFlags.Ephemeral;
const PAGE_SIZE = 25;

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
    return interaction.update(views.permissionsPanel(config));
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
    return interaction.update(views.ticketTypeEditor(config, type));
  }

  if (!id.startsWith('configx:')) return false;

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
    const payload = views.ticketTypeEditor(config, type);
    delete payload.ephemeral;
    return interaction.update(payload);
  }

  return false;
}

function isConfigExtensionId(id = '') {
  return id.startsWith('configx:')
    || id.startsWith('config:typeselector:')
    || id === 'config:set:staffroles'
    || id.startsWith('config:typeroles:');
}

module.exports = { handleConfigExtension, isConfigExtensionId, selectorAssignmentPayload };
