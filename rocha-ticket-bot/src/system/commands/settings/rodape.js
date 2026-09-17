const { getGuildConfig, saveGuildConfig } = require('../../../database/store');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const text = interaction.options.getString('texto', true).trim();
  if (!text) throw new Error('O rodapé não pode ficar vazio.');
  if (text.length > 200) throw new Error('O rodapé pode ter no máximo 200 caracteres.');

  const config = await getGuildConfig(interaction.guildId);
  config.branding ||= {};
  const old = config.branding.footer || '';
  config.branding.footer = text;
  await saveGuildConfig(interaction.guildId, config);

  await sendSystemAudit(interaction.guild, {
    action: 'Rodapé do RochaSystem alterado',
    actor: interaction.user,
    details: `Anterior: ${old || 'vazio'} • Novo: ${text}`
  });
  return interaction.editReply(`✅ Rodapé atualizado para: **${text}**`);
}

module.exports = { id: 'configuracao.rodape', execute };
