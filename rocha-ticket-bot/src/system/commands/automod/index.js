const { getGuildConfig, saveGuildConfig } = require('../../../database/store');
const { ensureSystemConfig } = require('../../../services/accessControlService');
const { ensureAutomod, normalizeWord } = require('../../../services/automodService');
const { sendSystemAudit } = require('../../../services/systemAuditService');

function commandIdForSubcommand(subcommand) {
  return `automod.${subcommand}`;
}

async function executeAutomod(interaction, subcommand) {
  const config = await getGuildConfig(interaction.guildId);
  const automod = ensureAutomod(ensureSystemConfig(config));

  if (subcommand === 'ver') {
    const words = automod.words.length ? automod.words.map(word => `\`${word}\``).join(', ') : '`nenhuma`';
    return interaction.editReply([
      '🤖 **AutoMod • RochaSystem**',
      `Status: **${automod.enabled ? 'Ativado' : 'Desativado'}**`,
      `Excluir mensagem: **${automod.deleteMessage ? 'Sim' : 'Não'}**`,
      `Avisar usuário: **${automod.notifyUser ? 'Sim' : 'Não'}**`,
      `Palavras bloqueadas (${automod.words.length}): ${words.slice(0, 1500)}`
    ].join('\n'));
  }

  if (subcommand === 'ativar' || subcommand === 'desativar') {
    automod.enabled = subcommand === 'ativar';
    await saveGuildConfig(interaction.guildId, config);
    await sendSystemAudit(interaction.guild, {
      action: `AutoMod ${automod.enabled ? 'ativado' : 'desativado'}`,
      actor: interaction.user,
      details: 'Configuração alterada pelo comando do RochaSystem.'
    }).catch(() => null);
    return interaction.editReply(`✅ AutoMod **${automod.enabled ? 'ativado' : 'desativado'}**.`);
  }

  if (subcommand === 'adicionar-palavra') {
    const word = normalizeWord(interaction.options.getString('palavra', true));
    if (!word || word.length < 2 || word.length > 50) throw new Error('A palavra deve ter entre 2 e 50 caracteres.');
    if (!automod.words.includes(word)) automod.words.push(word);
    await saveGuildConfig(interaction.guildId, config);
    return interaction.editReply(`✅ \`${word}\` adicionada ao filtro. Total: **${automod.words.length}**.`);
  }

  if (subcommand === 'remover-palavra') {
    const word = normalizeWord(interaction.options.getString('palavra', true));
    const before = automod.words.length;
    automod.words = automod.words.filter(item => item !== word);
    await saveGuildConfig(interaction.guildId, config);
    return interaction.editReply(before === automod.words.length ? `⚠️ \`${word}\` não estava no filtro.` : `✅ \`${word}\` removida do filtro.`);
  }

  if (subcommand === 'limpar-palavras') {
    const total = automod.words.length;
    automod.words = [];
    await saveGuildConfig(interaction.guildId, config);
    return interaction.editReply(`✅ Lista limpa. **${total}** palavra(s) removida(s).`);
  }

  throw new Error(`Subcomando AutoMod não implementado: ${subcommand}`);
}

module.exports = { commandIdForSubcommand, executeAutomod };
