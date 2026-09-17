const { SlashCommandBuilder } = require('discord.js');

const commandData = [
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Abre o painel privado de configuração do sistema de tickets.'),
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Publica/atualiza o painel de abertura de tickets.'),
  new SlashCommandBuilder()
    .setName('preview')
    .setDescription('Abre a central privada de prévias dos painéis e mensagens do sistema.'),
  new SlashCommandBuilder()
    .setName('diagnostico')
    .setDescription('Executa uma verificação privada de saúde do sistema de tickets.')
].map(command => command.toJSON());

async function registerGuildCommands(guild) {
  try {
    await guild.commands.set(commandData);
    console.log(`✅ Comandos registrados em ${guild.name} (${guild.id})`);
  } catch (error) {
    console.error(`❌ Falha ao registrar comandos em ${guild.id}:`, error.message);
  }
}

async function registerAll(client) {
  for (const guild of client.guilds.cache.values()) await registerGuildCommands(guild);
}

module.exports = { commandData, registerGuildCommands, registerAll };
