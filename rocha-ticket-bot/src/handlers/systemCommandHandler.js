const { EmbedBuilder, MessageFlags } = require('discord.js');
const { getGuildConfig } = require('../database/store');
const {
  canUseSystemCommand,
  accessibleCommands,
  ensureSystemConfig,
  configuredTiers,
  TIER_META
} = require('../services/accessControlService');
const {
  setBotName,
  setBotBio,
  setBotAvatar,
  setBotBanner,
  setBotPresence
} = require('../services/botIdentityService');
const { COMMAND_CATEGORIES } = require('../system/commandCatalog');
const { executeAdmin, commandIdForSubcommand: adminCommandId } = require('../system/commands/admin');
const { executeModeration, commandIdForSubcommand: moderationCommandId } = require('../system/commands/moderation');
const { executeOwner, commandIdForSubcommand: ownerCommandId } = require('../system/commands/owner');
const { executeSettings, commandIdForSubcommand: settingsCommandId } = require('../system/commands/settings');
const { executeUtility, commandIdForSubcommand: utilityCommandId } = require('../system/commands/utility');
const { executeAutomod, commandIdForSubcommand: automodCommandId } = require('../system/commands/automod');
const { executeLevels, commandIdForSubcommand: levelsCommandId } = require('../system/commands/levels');
const { executeFun, commandIdForSubcommand: funCommandId } = require('../system/commands/fun');
const { executeGames, commandIdForSubcommand: gamesCommandId } = require('../system/commands/games');
const { executeSearch, commandIdForSubcommand: searchCommandId } = require('../system/commands/search');
const { executeBackup, commandIdForSubcommand: backupCommandId } = require('../system/commands/backup');
const { executeSupport, commandIdForSubcommand: supportCommandId } = require('../system/commands/support');
const { colorInt, truncate } = require('../utils/discord');

const EPHEMERAL = MessageFlags.Ephemeral;

async function deny(interaction, commandId) {
  const access = await canUseSystemCommand(interaction, commandId);
  if (access.allowed) return access;
  await interaction.reply({ content: `⛔ ${access.reason}`, flags: EPHEMERAL });
  return null;
}

function identityEmbed(config, interaction) {
  const identity = ensureSystemConfig(config).identity;
  const appDescription = interaction.client.application?.description || identity.bio;
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle('🤖 Perfil do RochaSystem')
    .setDescription([
      `**Usuário:** ${interaction.client.user}`,
      `**Nome:** ${interaction.client.user.username}`,
      `**ID:** \`${interaction.client.user.id}\``,
      `**Status configurado:** \`${identity.status}\``,
      `**Atividade:** ${identity.activity || '`nenhuma`'}`,
      '',
      '**Bio da aplicação:**',
      appDescription || '_sem descrição_'
    ].join('\n'))
    .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();
  if (interaction.client.user.bannerURL?.()) embed.setImage(interaction.client.user.bannerURL({ size: 1024 }));
  return embed;
}

async function handleBotCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  const commandId = `bot.${sub}`;
  const access = await deny(interaction, commandId);
  if (!access) return true;

  if (sub === 'perfil') {
    const config = await getGuildConfig(interaction.guildId);
    await interaction.client.application.fetch().catch(() => null);
    await interaction.client.user.fetch(true).catch(() => null);
    return interaction.reply({ embeds: [identityEmbed(config, interaction)], flags: EPHEMERAL });
  }

  await interaction.deferReply({ flags: EPHEMERAL });
  try {
    if (sub === 'nome') {
      const name = interaction.options.getString('nome', true);
      const value = await setBotName(interaction.client, interaction.guildId, name);
      return interaction.editReply(`✅ Nome do bot alterado para **${value}**.`);
    }
    if (sub === 'bio') {
      const bio = interaction.options.getString('descricao', true);
      await setBotBio(interaction.client, interaction.guildId, bio);
      return interaction.editReply('✅ Descrição/Bio do RochaSystem atualizada.');
    }
    if (sub === 'avatar') {
      const image = interaction.options.getAttachment('imagem', true);
      if (image.contentType && !image.contentType.startsWith('image/')) throw new Error('Envie um arquivo de imagem válido.');
      await setBotAvatar(interaction.client, interaction.guildId, image.url);
      return interaction.editReply('✅ Foto do RochaSystem atualizada.');
    }
    if (sub === 'banner') {
      const image = interaction.options.getAttachment('imagem', true);
      if (image.contentType && !image.contentType.startsWith('image/')) throw new Error('Envie um arquivo de imagem válido.');
      await setBotBanner(interaction.client, interaction.guildId, image.url);
      return interaction.editReply('✅ Banner do RochaSystem atualizado.');
    }
    if (sub === 'status') {
      const status = interaction.options.getString('status', true);
      const activity = interaction.options.getString('atividade') || '';
      const result = await setBotPresence(interaction.client, interaction.guildId, status, activity);
      return interaction.editReply(`✅ Presença atualizada: **${result.status}**${result.activity ? ` • ${result.activity}` : ''}.`);
    }
    return interaction.editReply('❌ Subcomando desconhecido.');
  } catch (error) {
    return interaction.editReply(`❌ Não foi possível alterar o perfil do bot.\n\`${truncate(error.message || String(error), 1500)}\``);
  }
}

async function handleProtectedGroup(interaction, commandId, executor) {
  const access = await canUseSystemCommand(interaction, commandId);
  if (!access.allowed) {
    await interaction.reply({ content: `⛔ ${access.reason}`, flags: EPHEMERAL });
    return true;
  }
  await interaction.deferReply({ flags: EPHEMERAL });
  try {
    await executor();
  } catch (error) {
    const message = truncate(error?.message || String(error), 1600);
    await interaction.editReply(`❌ Não foi possível concluir a ação.\n\`${message}\``).catch(() => null);
  }
  return true;
}

function protectedGroup(idBuilder, executor) {
  return async interaction => {
    const sub = interaction.options.getSubcommand();
    return handleProtectedGroup(interaction, idBuilder(sub), () => executor(interaction, sub));
  };
}

const handleAdminCommand = protectedGroup(adminCommandId, executeAdmin);
const handleModerationCommand = protectedGroup(moderationCommandId, executeModeration);
const handleOwnerCommand = protectedGroup(ownerCommandId, executeOwner);
const handleSettingsCommand = protectedGroup(settingsCommandId, executeSettings);
const handleUtilityCommand = protectedGroup(utilityCommandId, executeUtility);
const handleAutomodCommand = protectedGroup(automodCommandId, executeAutomod);
const handleLevelsCommand = protectedGroup(levelsCommandId, executeLevels);
const handleFunCommand = protectedGroup(funCommandId, executeFun);
const handleGamesCommand = protectedGroup(gamesCommandId, executeGames);
const handleSearchCommand = protectedGroup(searchCommandId, executeSearch);
const handleBackupCommand = protectedGroup(backupCommandId, executeBackup);
const handleSupportCommand = protectedGroup(supportCommandId, executeSupport);

async function handleHelpCommand(interaction) {
  const access = await deny(interaction, 'ajuda');
  if (!access) return true;
  const config = await getGuildConfig(interaction.guildId);
  const commands = accessibleCommands(config, interaction.member, interaction.guild, interaction.user.id);
  const tiers = configuredTiers(config, interaction.member);
  const tierLabel = access.owner ? '👑 Dono' : tiers.map(tier => `${TIER_META[tier]?.emoji || '•'} ${TIER_META[tier]?.label || tier}`).join(', ');
  const groups = new Map();
  for (const command of commands) {
    if (!groups.has(command.category)) groups.set(command.category, []);
    groups.get(command.category).push(command);
  }
  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle('🦊 RochaSystem • Comandos disponíveis')
    .setDescription(`**Seu acesso:** ${tierLabel || 'nenhum'}\n\nAqui aparecem somente os comandos que os seus cargos podem utilizar.`)
    .setTimestamp();
  for (const [category, list] of groups) {
    const meta = COMMAND_CATEGORIES[category] || { label: category, emoji: '•' };
    const text = list.map(command => `• \`/${command.slash}\` — ${command.label}`).join('\n');
    embed.addFields({ name: `${meta.emoji} ${meta.label}`, value: truncate(text, 1024), inline: false });
    if (embed.data.fields?.length >= 25) break;
  }
  if (!groups.size) embed.addFields({ name: 'Sem comandos', value: 'Seu cargo está configurado, mas ainda não possui categorias ou comandos liberados.' });
  return interaction.reply({ embeds: [embed], flags: EPHEMERAL });
}

async function handleSystemSlashCommand(interaction) {
  if (!interaction.isChatInputCommand()) return false;
  const handlers = {
    bot: handleBotCommand,
    admin: handleAdminCommand,
    moderacao: handleModerationCommand,
    dono: handleOwnerCommand,
    configuracao: handleSettingsCommand,
    utilidade: handleUtilityCommand,
    automod: handleAutomodCommand,
    suporte: handleSupportCommand,
    nivel: handleLevelsCommand,
    diversao: handleFunCommand,
    jogo: handleGamesCommand,
    pesquisa: handleSearchCommand,
    backup: handleBackupCommand,
    ajuda: handleHelpCommand
  };
  const handler = handlers[interaction.commandName];
  if (!handler) return false;
  await handler(interaction);
  return true;
}

module.exports = {
  handleSystemSlashCommand,
  handleBotCommand,
  handleAdminCommand,
  handleModerationCommand,
  handleOwnerCommand,
  handleSettingsCommand,
  handleUtilityCommand,
  handleAutomodCommand,
  handleSupportCommand,
  handleLevelsCommand,
  handleFunCommand,
  handleGamesCommand,
  handleSearchCommand,
  handleBackupCommand,
  handleHelpCommand
};
