const { getGuildConfig, saveGuildConfig } = require('../../../database/store');
const { ensureSystemConfig } = require('../../../services/accessControlService');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const channel = interaction.options.getChannel('canal');
  const config = await getGuildConfig(interaction.guildId);
  const system = ensureSystemConfig(config);
  const oldId = system.audit.channelId;
  system.audit.channelId = channel?.id || null;
  await saveGuildConfig(interaction.guildId, config);

  await sendSystemAudit(interaction.guild, {
    action: 'Canal de auditoria alterado',
    actor: interaction.user,
    details: `Anterior: ${oldId ? `<#${oldId}>` : 'não configurado'} • Novo: ${channel || 'herdar log padrão'}`
  });
  return interaction.editReply(channel
    ? `✅ O canal de auditoria do RochaSystem agora é ${channel}.`
    : '✅ O canal específico de auditoria foi removido. O RochaSystem passará a usar o log padrão quando existir.');
}

module.exports = { id: 'configuracao.auditoria', execute };
