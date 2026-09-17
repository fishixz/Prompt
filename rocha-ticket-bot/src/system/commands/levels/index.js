const { EmbedBuilder } = require('discord.js');
const { getGuildConfig, saveGuildConfig } = require('../../../database/store');
const { ensureSystemConfig } = require('../../../services/accessControlService');
const { ensureLevelConfig, getLevelProfile, getRanking } = require('../../../services/levelService');
const { colorInt } = require('../../../utils/discord');

function commandIdForSubcommand(subcommand) {
  return `nivel.${subcommand}`;
}

async function executeLevels(interaction, subcommand) {
  const config = await getGuildConfig(interaction.guildId);
  const settings = ensureLevelConfig(ensureSystemConfig(config));

  if (subcommand === 'perfil') {
    const user = interaction.options.getUser('usuario') || interaction.user;
    const profile = await getLevelProfile(interaction.guildId, user.id);
    const embed = new EmbedBuilder()
      .setColor(colorInt(config.branding?.color || '#F5A300'))
      .setTitle(`📈 Nível • ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Nível', value: `**${profile.level}**`, inline: true },
        { name: 'XP total', value: `**${profile.xp || 0}**`, inline: true },
        { name: 'Mensagens com XP', value: `**${profile.messages || 0}**`, inline: true },
        { name: 'Progresso', value: `${profile.currentXp}/${profile.requiredXp} XP`, inline: false }
      )
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === 'ranking') {
    const ranking = await getRanking(interaction.guildId, 10);
    const lines = ranking.length
      ? ranking.map((item, index) => `**${index + 1}.** <@${item.userId}> • nível **${item.level}** • **${item.xp || 0} XP**`).join('\n')
      : '_Ainda não existem dados de XP._';
    const embed = new EmbedBuilder()
      .setColor(colorInt(config.branding?.color || '#F5A300'))
      .setTitle('🏆 Ranking de níveis • RochaSystem')
      .setDescription(lines)
      .setFooter({ text: settings.enabled ? 'Sistema de níveis ativado' : 'Sistema de níveis desativado' });
    return interaction.editReply({ embeds: [embed] });
  }

  if (subcommand === 'ativar' || subcommand === 'desativar') {
    settings.enabled = subcommand === 'ativar';
    await saveGuildConfig(interaction.guildId, config);
    return interaction.editReply(`✅ Sistema de níveis **${settings.enabled ? 'ativado' : 'desativado'}**.`);
  }

  if (subcommand === 'configurar') {
    const min = interaction.options.getInteger('xp_minimo', true);
    const max = interaction.options.getInteger('xp_maximo', true);
    const cooldown = interaction.options.getInteger('cooldown', true);
    if (max < min) throw new Error('O XP máximo não pode ser menor que o XP mínimo.');
    settings.xpMin = min;
    settings.xpMax = max;
    settings.cooldownSeconds = cooldown;
    await saveGuildConfig(interaction.guildId, config);
    return interaction.editReply(`✅ Níveis configurados: **${min}-${max} XP** por mensagem válida, cooldown de **${cooldown}s**.`);
  }

  throw new Error(`Subcomando de níveis não implementado: ${subcommand}`);
}

module.exports = { commandIdForSubcommand, executeLevels };
