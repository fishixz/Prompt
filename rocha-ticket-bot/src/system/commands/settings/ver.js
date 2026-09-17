const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../../database/store');
const { ensureSystemConfig, TIER_ORDER, TIER_META } = require('../../../services/accessControlService');
const { colorInt } = require('../../../utils/discord');

async function execute(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  const system = ensureSystemConfig(config);
  const access = TIER_ORDER.map(tier => {
    const roleIds = system.access[tier].roleIds;
    return `${TIER_META[tier].emoji} **${TIER_META[tier].label}:** ${roleIds.length ? roleIds.map(id => `<@&${id}>`).join(', ') : '`sem cargo`'} • ${system.access[tier].categories.length} categoria(s) • ${system.access[tier].commands.length} comando(s) extra(s)`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(colorInt(config.branding?.color || '#F5A300'))
    .setTitle('⚙️ RochaSystem • Configuração atual')
    .setDescription([
      `**Nome:** ${system.identity.name}`,
      `**Cor principal:** \`${config.branding?.color || '#F5A300'}\``,
      `**Canal de auditoria:** ${system.audit.channelId ? `<#${system.audit.channelId}>` : config.logs?.defaultChannelId ? `herda <#${config.logs.defaultChannelId}>` : '`não configurado`'}`,
      `**Painel de tickets:** ${config.panel?.channelId ? `<#${config.panel.channelId}>` : '`não configurado`'}`,
      '',
      '**Cargos e acessos:**',
      access
    ].join('\n'))
    .setTimestamp();
  return interaction.editReply({ embeds: [embed] });
}

module.exports = { id: 'configuracao.ver', execute };
