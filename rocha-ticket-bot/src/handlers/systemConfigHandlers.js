const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const { getGuildConfig, saveGuildConfig } = require('../database/store');
const { ensureSystemConfig, TIER_META } = require('../services/accessControlService');
const { COMMAND_CATALOG } = require('../system/commandCatalog');
const {
  systemHomePanel,
  tierPanel,
  commandAccessPanel,
  profilePanel
} = require('../panels/systemConfigPanel');

const PAGE_SIZE = 25;
const EPHEMERAL = MessageFlags.Ephemeral;

function clean(payload) {
  const out = { ...payload };
  delete out.ephemeral;
  delete out.flags;
  return out;
}

async function handleSystemConfig(interaction) {
  const id = interaction.customId || '';
  if (!id.startsWith('systemcfg:')) return false;

  const config = await getGuildConfig(interaction.guildId);
  const system = ensureSystemConfig(config);

  if (id === 'systemcfg:home') {
    return interaction.update(clean(systemHomePanel(config)));
  }

  if (id === 'systemcfg:profile' || id === 'systemcfg:profile:refresh') {
    return interaction.update(clean(profilePanel(config)));
  }

  if (id.startsWith('systemcfg:tier:')) {
    const tier = id.split(':')[2];
    const payload = tierPanel(config, tier);
    if (!payload) return interaction.reply({ content: '❌ Nível de acesso inválido.', flags: EPHEMERAL });
    return interaction.update(clean(payload));
  }

  if (id.startsWith('systemcfg:commands:')) {
    const [, , tier, rawPage] = id.split(':');
    const payload = commandAccessPanel(config, tier, Number(rawPage) || 0);
    if (!payload) return interaction.reply({ content: '❌ Nível de acesso inválido.', flags: EPHEMERAL });
    return interaction.update(clean(payload));
  }

  if (id.startsWith('systemcfg:roles:') && interaction.isRoleSelectMenu()) {
    const tier = id.split(':')[2];
    if (!system.access[tier]) return interaction.reply({ content: '❌ Nível de acesso inválido.', flags: EPHEMERAL });
    system.access[tier].roleIds = [...new Set(interaction.values)];
    await saveGuildConfig(interaction.guildId, config);
    return interaction.update(clean(tierPanel(config, tier)));
  }

  if (id.startsWith('systemcfg:categories:') && interaction.isStringSelectMenu()) {
    const tier = id.split(':')[2];
    if (!system.access[tier]) return interaction.reply({ content: '❌ Nível de acesso inválido.', flags: EPHEMERAL });
    system.access[tier].categories = [...new Set(interaction.values)];
    await saveGuildConfig(interaction.guildId, config);
    return interaction.update(clean(tierPanel(config, tier)));
  }

  if (id.startsWith('systemcfg:commandset:') && interaction.isStringSelectMenu()) {
    const [, , tier, rawPage] = id.split(':');
    if (!system.access[tier]) return interaction.reply({ content: '❌ Nível de acesso inválido.', flags: EPHEMERAL });

    const all = COMMAND_CATALOG.filter(command => !command.ownerOnly || tier === 'dono');
    const page = Math.max(0, Number(rawPage) || 0);
    const pageIds = new Set(all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map(command => command.id));
    const kept = (system.access[tier].commands || []).filter(commandId => !pageIds.has(commandId));
    system.access[tier].commands = [...new Set([...kept, ...interaction.values])];
    await saveGuildConfig(interaction.guildId, config);
    return interaction.update(clean(commandAccessPanel(config, tier, page)));
  }

  if (id.startsWith('systemcfg:clear:')) {
    const tier = id.split(':')[2];
    if (!system.access[tier]) return interaction.reply({ content: '❌ Nível de acesso inválido.', flags: EPHEMERAL });
    const meta = TIER_META[tier];
    return interaction.reply({
      content: `⚠️ Deseja remover **todas as categorias e comandos individuais** do nível **${meta?.label || tier}**? Os cargos vinculados serão mantidos.`,
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`systemcfg:clearconfirm:${tier}`).setLabel('Sim, limpar acessos').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('systemcfg:clearcancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
      )],
      flags: EPHEMERAL
    });
  }

  if (id.startsWith('systemcfg:clearconfirm:')) {
    const tier = id.split(':')[2];
    if (!system.access[tier]) return interaction.update({ content: '❌ Nível inválido.', components: [] });
    system.access[tier].categories = [];
    system.access[tier].commands = [];
    await saveGuildConfig(interaction.guildId, config);
    return interaction.update({ content: `✅ Acessos do nível **${TIER_META[tier]?.label || tier}** foram limpos.`, components: [] });
  }

  if (id === 'systemcfg:clearcancel') {
    return interaction.update({ content: '✅ Alteração cancelada.', components: [] });
  }

  return false;
}

function isSystemConfigId(id = '') {
  return id.startsWith('systemcfg:');
}

module.exports = { handleSystemConfig, isSystemConfigId };
