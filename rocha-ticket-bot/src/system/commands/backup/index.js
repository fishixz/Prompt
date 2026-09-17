const fs = require('node:fs/promises');
const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');
const { BACKUP_DIR, createRollingBackup } = require('../../../services/backupService');
const { backupString, readValidJson, replaceState } = require('../../../database/store');

function commandIdForSubcommand(subcommand) {
  return `backup.${subcommand}`;
}

async function listBackups() {
  try {
    const names = (await fs.readdir(BACKUP_DIR))
      .filter(name => /^database-.*\.json$/.test(name))
      .sort((a, b) => b.localeCompare(a));
    return Promise.all(names.map(async name => {
      const file = path.join(BACKUP_DIR, name);
      const stat = await fs.stat(file);
      return { name, size: stat.size, mtime: stat.mtime };
    }));
  } catch {
    return [];
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function executeBackup(interaction, subcommand) {
  if (subcommand === 'criar') {
    const result = await createRollingBackup({ keep: 30 });
    return interaction.editReply(`✅ Backup criado: \`${path.basename(result.filePath)}\`.`);
  }

  if (subcommand === 'listar') {
    const backups = await listBackups();
    const text = backups.length
      ? backups.slice(0, 20).map((item, index) => `${index + 1}. \`${item.name}\` • ${formatBytes(item.size)}`).join('\n')
      : '_Nenhum backup local encontrado._';
    return interaction.editReply(`💾 **Backups do RochaSystem**\n${text}`);
  }

  if (subcommand === 'exportar') {
    const json = await backupString();
    const attachment = new AttachmentBuilder(Buffer.from(json, 'utf8'), { name: `rochasystem-backup-${Date.now()}.json` });
    return interaction.editReply({ content: '✅ Backup atual exportado.', files: [attachment] });
  }

  if (subcommand === 'restaurar') {
    const name = interaction.options.getString('arquivo', true).trim();
    if (!/^database-[A-Za-z0-9_.-]+\.json$/.test(name)) throw new Error('Nome de backup inválido. Use exatamente um nome mostrado em `/backup listar`.');
    const target = path.join(BACKUP_DIR, name);
    const before = await createRollingBackup({ keep: 30 });
    const snapshot = await readValidJson(target);
    if (!snapshot) throw new Error('O backup informado não existe ou está inválido.');
    await replaceState(snapshot);
    return interaction.editReply(`✅ Backup \`${name}\` restaurado. Uma cópia preventiva foi criada antes da restauração: \`${path.basename(before.filePath)}\`. Reinicie o RochaSystem para reaplicar toda a configuração em memória do Discord.`);
  }

  throw new Error(`Subcomando de backup não implementado: ${subcommand}`);
}

module.exports = { commandIdForSubcommand, executeBackup, listBackups };
