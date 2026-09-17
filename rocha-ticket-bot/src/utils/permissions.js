const { PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../database/store');
const {
  ensureSystemConfig,
  isOwnerFromConfig,
  canConfigureRochaSystem
} = require('../services/accessControlService');

function memberHasAnyRole(member, roleIds = []) {
  if (!member || !roleIds?.length) return false;
  return roleIds.some(id => member.roles?.cache?.has(id));
}

async function canConfigure(interaction) {
  return canConfigureRochaSystem(interaction);
}

async function canManageTicket(interaction, ticketType = null) {
  if (!interaction.inGuild()) return false;
  const config = await getGuildConfig(interaction.guildId);
  const system = ensureSystemConfig(config);

  if (isOwnerFromConfig(config, interaction.guild, interaction.member, interaction.user.id)) return true;
  if (memberHasAnyRole(interaction.member, system.access.moderador?.roleIds || [])) return true;
  if (memberHasAnyRole(interaction.member, system.access.suporte?.roleIds || [])) return true;

  // Compatibilidade com permissões específicas do sistema de tickets já existente.
  if (config.permissions?.adminUserIds?.includes(interaction.user.id)) return true;
  if (memberHasAnyRole(interaction.member, config.permissions?.adminRoleIds)) return true;
  if (memberHasAnyRole(interaction.member, config.permissions?.staffRoleIds)) return true;
  if (ticketType && memberHasAnyRole(interaction.member, ticketType.staffRoleIds || [])) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  return false;
}

module.exports = { memberHasAnyRole, canConfigure, canManageTicket };
