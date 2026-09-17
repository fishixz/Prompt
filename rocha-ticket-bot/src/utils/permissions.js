const { PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../database/store');

function memberHasAnyRole(member, roleIds = []) {
  if (!member || !roleIds?.length) return false;
  return roleIds.some(id => member.roles?.cache?.has(id));
}

async function canConfigure(interaction) {
  if (!interaction.inGuild()) return false;
  const config = await getGuildConfig(interaction.guildId);

  const hasConfiguredAdmins = Boolean(config.permissions?.adminRoleIds?.length || config.permissions?.adminUserIds?.length);
  if (!hasConfiguredAdmins && config.security?.allowConfigBeforeSetupForEveryone) {
    return true;
  }

  if (config.permissions?.allowGuildOwner && interaction.guild.ownerId === interaction.user.id) return true;
  if (config.permissions?.adminUserIds?.includes(interaction.user.id)) return true;
  if (memberHasAnyRole(interaction.member, config.permissions?.adminRoleIds)) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  return false;
}

async function canManageTicket(interaction, ticketType = null) {
  if (!interaction.inGuild()) return false;
  const config = await getGuildConfig(interaction.guildId);
  if (config.permissions?.allowGuildOwner && interaction.guild.ownerId === interaction.user.id) return true;
  if (config.permissions?.adminUserIds?.includes(interaction.user.id)) return true;
  if (memberHasAnyRole(interaction.member, config.permissions?.adminRoleIds)) return true;
  if (memberHasAnyRole(interaction.member, config.permissions?.staffRoleIds)) return true;
  if (ticketType && memberHasAnyRole(interaction.member, ticketType.staffRoleIds || [])) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  return false;
}

module.exports = { memberHasAnyRole, canConfigure, canManageTicket };
