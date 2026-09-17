const { SlashCommandBuilder } = require('discord.js');

const updateCommandData = new SlashCommandBuilder()
  .setName('update')
  .setDescription('Verifica e instala manualmente uma nova versão do RochaSystem. Exclusivo do Dono.')
  .toJSON();

module.exports = { updateCommandData };
