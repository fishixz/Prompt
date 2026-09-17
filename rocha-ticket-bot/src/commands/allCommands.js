const { commandData } = require('./registerCommands');
const { extraCommandData } = require('./extraCommands');
const { updateCommandData } = require('./updateCommand');

const allCommandData = [...commandData, ...extraCommandData, updateCommandData];

async function registerGuildSystemCommands(guild) {
  try {
    await guild.commands.set(allCommandData);
    console.log(`✅ ${allCommandData.length} comandos/grupos do RochaSystem registrados em ${guild.name} (${guild.id}).`);
    return true;
  } catch (error) {
    console.error(`❌ Falha ao registrar comandos RochaSystem em ${guild.id}:`, error.message);
    return false;
  }
}

async function registerAllSystemCommands(client) {
  for (const guild of client.guilds.cache.values()) {
    await registerGuildSystemCommands(guild);
  }
}

module.exports = { allCommandData, registerGuildSystemCommands, registerAllSystemCommands };
