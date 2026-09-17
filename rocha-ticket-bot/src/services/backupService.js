const fs = require('node:fs/promises');
const path = require('node:path');
const { DB_PATH, getState, persist } = require('../database/store');

const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups');
const DEFAULT_KEEP = 7;

function backupFileName(date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `database-${stamp}.json`;
}

async function createRollingBackup({ keep = DEFAULT_KEEP } = {}) {
  await getState();
  await persist();
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const data = await fs.readFile(DB_PATH, 'utf8');
  JSON.parse(data);

  const filePath = path.join(BACKUP_DIR, backupFileName());
  await fs.writeFile(filePath, data, 'utf8');

  const files = (await fs.readdir(BACKUP_DIR))
    .filter(name => /^database-.*\.json$/.test(name))
    .sort()
    .reverse();

  const safeKeep = Math.max(1, Math.min(30, Number(keep) || DEFAULT_KEEP));
  for (const old of files.slice(safeKeep)) {
    await fs.unlink(path.join(BACKUP_DIR, old)).catch(() => null);
  }

  return { filePath, kept: Math.min(files.length, safeKeep) };
}

module.exports = { BACKUP_DIR, createRollingBackup };
