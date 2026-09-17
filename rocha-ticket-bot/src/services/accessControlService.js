const { PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../database/store');
const { COMMAND_CATEGORIES, COMMAND_CATALOG, commandById } = require('../system/commandCatalog');

const TIER_ORDER = ['dono', 'moderador', 'suporte', 'cidadao', 'visitante'];
const TIER_META = {
  dono: { label: 'Dono', emoji: '👑' },
  moderador: { label: 'Moderador', emoji: '🛡️' },
  suporte: { label: 'Suporte', emoji: '🎧' },
  cidadao: { label: 'Cidadão', emoji: '🏙️' },
  visitante: { label: 'Visitante', emoji: '👤' }
};

const DEFAULT_BIO = 'Sistema Oficial de Bots do RochaSystem.\n\nDeveloped with ♥️ by raposomodz';

function defaultTier(categories = []) {
  return { roleIds: [], categories: [...categories], commands: [] };
}

function defaultSystemConfig() {
  return {
    identity: {
      name: 'RochaSystem',
      bio: DEFAULT_BIO,
      status: 'online',
      activity: 'RochaSystem • Rocha Roleplay',
      avatarUrl: null,
      bannerUrl: null
    },
    access: {
      dono: defaultTier(Object.keys(COMMAND_CATEGORIES)),
      moderador: defaultTier(['administracao', 'moderacao']),
      suporte: defaultTier(['suporte', 'tickets', 'utilidades']),
      cidadao: defaultTier(['utilidades', 'pesquisa', 'diversao', 'jogos', 'niveis']),
      visitante: defaultTier(['utilidades'])
    },
    audit: { channelId: null },
    automod: {
      enabled: false,
      deleteMessage: true,
      notifyUser: true,
      words: []
    },
    levels: {
      enabled: true,
      xpMin: 5,
      xpMax: 15,
      cooldownSeconds: 60
    }
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureSystemConfig(config) {
  const defaults = defaultSystemConfig();
  if (!config.system || typeof config.system !== 'object') config.system = clone(defaults);

  config.system.identity = { ...defaults.identity, ...(config.system.identity || {}) };
  config.system.audit = { ...defaults.audit, ...(config.system.audit || {}) };
  config.system.automod = { ...defaults.automod, ...(config.system.automod || {}) };
  config.system.automod.words = Array.isArray(config.system.automod.words) ? config.system.automod.words : [];
  config.system.levels = { ...defaults.levels, ...(config.system.levels || {}) };
  config.system.access ||= {};

  for (const tier of TIER_ORDER) {
    const current = config.system.access[tier] || {};
    config.system.access[tier] = {
      roleIds: Array.isArray(current.roleIds) ? current.roleIds : [],
      categories: Array.isArray(current.categories) ? current.categories : [...defaults.access[tier].categories],
      commands: Array.isArray(current.commands) ? current.commands : []
    };
  }

  return config.system;
}

function memberHasRole(member, roleIds = []) {
  if (!member || !Array.isArray(roleIds) || !roleIds.length) return false;
  return roleIds.some(roleId => member.roles?.cache?.has(roleId));
}

function configuredTiers(config, member) {
  const system = ensureSystemConfig(config);
  return TIER_ORDER.filter(tier => memberHasRole(member, system.access[tier].roleIds));
}

function hasConfiguredOwner(config) {
  const system = ensureSystemConfig(config);
  return system.access.dono.roleIds.length > 0;
}

function isOwnerFromConfig(config, guild, member, userId) {
  if (!guild || !userId) return false;
  if (guild.ownerId === userId) return true;
  const system = ensureSystemConfig(config);
  return memberHasRole(member, system.access.dono.roleIds);
}

async function isSystemOwner(interaction) {
  if (!interaction?.inGuild?.()) return false;
  const config = await getGuildConfig(interaction.guildId);
  return isOwnerFromConfig(config, interaction.guild, interaction.member, interaction.user.id);
}

function categoryAllowedForTier(system, tier, category) {
  return system.access[tier]?.categories?.includes(category) || false;
}

function commandAllowedForTier(system, tier, commandId) {
  return system.access[tier]?.commands?.includes(commandId) || false;
}

async function canUseSystemCommand(interaction, commandId) {
  if (!interaction?.inGuild?.()) return { allowed: false, reason: 'Este comando só pode ser usado dentro do servidor.' };

  const config = await getGuildConfig(interaction.guildId);
  const system = ensureSystemConfig(config);
  const command = commandById(commandId);
  if (!command) return { allowed: false, reason: 'Comando não registrado no controle de acesso.' };

  const owner = isOwnerFromConfig(config, interaction.guild, interaction.member, interaction.user.id);
  if (command.ownerOnly) {
    return owner
      ? { allowed: true, tier: 'dono', owner: true }
      : { allowed: false, reason: 'Este comando é exclusivo do cargo **Dono** do RochaSystem.' };
  }

  if (owner) return { allowed: true, tier: 'dono', owner: true };

  const tiers = configuredTiers(config, interaction.member);
  if (!tiers.length) {
    return { allowed: false, reason: 'Você não possui nenhum cargo do RochaSystem configurado para usar comandos.' };
  }

  const explicit = tiers.find(tier => commandAllowedForTier(system, tier, commandId));
  if (explicit) return { allowed: true, tier: explicit, owner: false };

  const category = tiers.find(tier => categoryAllowedForTier(system, tier, command.category));
  if (category) return { allowed: true, tier: category, owner: false };

  return {
    allowed: false,
    reason: `Seus cargos do RochaSystem não possuem acesso à categoria **${COMMAND_CATEGORIES[command.category]?.label || command.category}** nem a este comando individualmente.`
  };
}

async function canConfigureRochaSystem(interaction) {
  if (!interaction?.inGuild?.()) return false;
  const config = await getGuildConfig(interaction.guildId);
  if (isOwnerFromConfig(config, interaction.guild, interaction.member, interaction.user.id)) return true;

  if (!hasConfiguredOwner(config)) {
    if (config.permissions?.adminUserIds?.includes(interaction.user.id)) return true;
    if (memberHasRole(interaction.member, config.permissions?.adminRoleIds || [])) return true;
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  }
  return false;
}

function accessibleCommands(config, member, guild, userId) {
  const system = ensureSystemConfig(config);
  const owner = isOwnerFromConfig(config, guild, member, userId);
  if (owner) return [...COMMAND_CATALOG];
  const tiers = configuredTiers(config, member);
  if (!tiers.length) return [];
  return COMMAND_CATALOG.filter(command => {
    if (command.ownerOnly) return false;
    return tiers.some(tier => commandAllowedForTier(system, tier, command.id) || categoryAllowedForTier(system, tier, command.category));
  });
}

module.exports = {
  TIER_ORDER,
  TIER_META,
  DEFAULT_BIO,
  defaultSystemConfig,
  ensureSystemConfig,
  memberHasRole,
  configuredTiers,
  hasConfiguredOwner,
  isOwnerFromConfig,
  isSystemOwner,
  canUseSystemCommand,
  canConfigureRochaSystem,
  accessibleCommands
};
