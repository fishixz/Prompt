const { getGuildConfig, saveGuildConfig } = require('../../../database/store');
const { sendSystemAudit } = require('../../../services/systemAuditService');

function normalizeColor(input) {
  const value = String(input || '').trim().replace(/^#/, '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(value)) throw new Error('Cor inválida. Use hexadecimal com 6 dígitos, por exemplo `#F5A300`.');
  return `#${value}`;
}

async function execute(interaction) {
  const color = normalizeColor(interaction.options.getString('hex', true));
  const config = await getGuildConfig(interaction.guildId);
  const old = config.branding?.color || '#F5A300';
  config.branding ||= {};
  config.branding.color = color;
  await saveGuildConfig(interaction.guildId, config);

  await sendSystemAudit(interaction.guild, {
    action: 'Cor do RochaSystem alterada',
    actor: interaction.user,
    details: `Anterior: \`${old}\` • Nova: \`${color}\``
  });
  return interaction.editReply(`✅ Cor principal alterada para \`${color}\`.`);
}

module.exports = { id: 'configuracao.cor', execute, normalizeColor };
