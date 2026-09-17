const { SlashCommandBuilder } = require('discord.js');

const commandData = [
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Abre o painel privado de configuração do RochaSystem.'),
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Publica/atualiza o painel de abertura de tickets.'),
  new SlashCommandBuilder()
    .setName('preview')
    .setDescription('Abre a central privada de prévias dos painéis e mensagens do sistema.'),
  new SlashCommandBuilder()
    .setName('diagnostico')
    .setDescription('Executa uma verificação privada de saúde do RochaSystem.'),
  new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Mostra somente os comandos liberados para os seus cargos.'),
  new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Gerencia o perfil e a identidade do RochaSystem.')
    .addSubcommand(sub => sub
      .setName('perfil')
      .setDescription('Mostra o perfil atual do RochaSystem.'))
    .addSubcommand(sub => sub
      .setName('nome')
      .setDescription('Altera o nome do bot. Exclusivo do Dono.')
      .addStringOption(option => option
        .setName('nome')
        .setDescription('Novo nome do bot.')
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(32)))
    .addSubcommand(sub => sub
      .setName('bio')
      .setDescription('Altera a descrição/Bio do bot. Exclusivo do Dono.')
      .addStringOption(option => option
        .setName('descricao')
        .setDescription('Nova descrição da aplicação/bot.')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(400)))
    .addSubcommand(sub => sub
      .setName('avatar')
      .setDescription('Altera a foto do bot. Exclusivo do Dono.')
      .addAttachmentOption(option => option
        .setName('imagem')
        .setDescription('Imagem que será usada como avatar.')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('banner')
      .setDescription('Altera o banner do bot. Exclusivo do Dono.')
      .addAttachmentOption(option => option
        .setName('imagem')
        .setDescription('Imagem que será usada como banner.')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Altera o status e a atividade do bot. Exclusivo do Dono.')
      .addStringOption(option => option
        .setName('status')
        .setDescription('Novo status do bot.')
        .setRequired(true)
        .addChoices(
          { name: 'Online', value: 'online' },
          { name: 'Ausente', value: 'idle' },
          { name: 'Não perturbe', value: 'dnd' },
          { name: 'Invisível', value: 'invisible' }
        ))
      .addStringOption(option => option
        .setName('atividade')
        .setDescription('Texto exibido como atividade do bot.')
        .setRequired(false)
        .setMaxLength(128)))
].map(command => command.toJSON());

async function registerGuildCommands(guild) {
  try {
    await guild.commands.set(commandData);
    console.log(`✅ Comandos RochaSystem registrados em ${guild.name} (${guild.id})`);
  } catch (error) {
    console.error(`❌ Falha ao registrar comandos em ${guild.id}:`, error.message);
  }
}

async function registerAll(client) {
  for (const guild of client.guilds.cache.values()) await registerGuildCommands(guild);
}

module.exports = { commandData, registerGuildCommands, registerAll };
