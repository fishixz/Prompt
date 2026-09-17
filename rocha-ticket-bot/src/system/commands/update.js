const {
  UPDATE_REPO,
  UPDATE_BRANCH,
  checkForUpdate,
  installAvailableUpdate,
  scheduleRestart
} = require('../../services/updateService');

async function execute(interaction) {
  await interaction.editReply(`🔎 Verificando atualizações do **RochaSystem** em \`${UPDATE_REPO}:${UPDATE_BRANCH}\`...`);

  const check = await checkForUpdate();
  if (check.remoteIsOlder) {
    return interaction.editReply([
      '✅ Nenhuma atualização será aplicada.',
      `Versão instalada: **${check.currentVersion}**`,
      `Versão publicada: **${check.remoteVersion}**`,
      'A versão publicada é inferior à instalada, então o RochaSystem permanecerá como está.'
    ].join('\n'));
  }

  if (!check.available) {
    return interaction.editReply([
      '✅ O RochaSystem já está atualizado.',
      `Versão instalada: **${check.currentVersion}**`,
      `Versão publicada: **${check.remoteVersion}**`
    ].join('\n'));
  }

  await interaction.editReply([
    `⬆️ Nova versão encontrada: **${check.currentVersion} → ${check.remoteVersion}**`,
    'Baixando os arquivos, instalando dependências e executando os testes antes de reiniciar...'
  ].join('\n'));

  const result = await installAvailableUpdate(check);
  if (!result.updated) {
    return interaction.editReply(`ℹ️ A atualização não precisou ser aplicada. Versão atual: **${result.currentVersion || check.currentVersion}**.`);
  }

  await interaction.editReply([
    '✅ **Atualização concluída com sucesso.**',
    `Versão anterior: **${result.previousVersion}**`,
    `Nova versão: **${result.currentVersion}**`,
    '',
    '🔄 O RochaSystem será reiniciado em alguns segundos para carregar os novos arquivos.'
  ].join('\n'));
  scheduleRestart(5_000);
  return true;
}

module.exports = { id: 'update', execute };
