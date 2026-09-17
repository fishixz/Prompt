const { SlashCommandBuilder, ChannelType } = require('discord.js');

const extraCommandData = [
  new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configura a automoderação do RochaSystem.')
    .addSubcommand(sub => sub.setName('ver').setDescription('Mostra a configuração atual do AutoMod.'))
    .addSubcommand(sub => sub.setName('ativar').setDescription('Ativa o filtro de palavras do AutoMod.'))
    .addSubcommand(sub => sub.setName('desativar').setDescription('Desativa o filtro de palavras do AutoMod.'))
    .addSubcommand(sub => sub
      .setName('adicionar-palavra').setDescription('Adiciona uma palavra ou expressão ao filtro.')
      .addStringOption(option => option.setName('palavra').setDescription('Palavra ou expressão a bloquear.').setRequired(true).setMinLength(2).setMaxLength(50)))
    .addSubcommand(sub => sub
      .setName('remover-palavra').setDescription('Remove uma palavra ou expressão do filtro.')
      .addStringOption(option => option.setName('palavra').setDescription('Palavra ou expressão a liberar.').setRequired(true).setMinLength(2).setMaxLength(50)))
    .addSubcommand(sub => sub.setName('limpar-palavras').setDescription('Remove todas as palavras do filtro.')),

  new SlashCommandBuilder()
    .setName('pesquisa')
    .setDescription('Ferramentas de pesquisa do RochaSystem.')
    .addSubcommand(sub => sub
      .setName('github').setDescription('Pesquisa um usuário público do GitHub.')
      .addStringOption(option => option.setName('usuario').setDescription('Nome de usuário do GitHub.').setRequired(true).setMaxLength(39)))
    .addSubcommand(sub => sub
      .setName('cargo').setDescription('Mostra informações de um cargo do servidor.')
      .addRoleOption(option => option.setName('cargo').setDescription('Cargo consultado.').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('canal').setDescription('Mostra informações de um canal do servidor.')
      .addChannelOption(option => option.setName('canal').setDescription('Canal consultado.').setRequired(true))),

  new SlashCommandBuilder()
    .setName('diversao')
    .setDescription('Comandos recreativos do RochaSystem.')
    .addSubcommand(sub => sub
      .setName('oito-bola').setDescription('Faça uma pergunta para a bola mágica.')
      .addStringOption(option => option.setName('pergunta').setDescription('Sua pergunta.').setRequired(true).setMaxLength(300)))
    .addSubcommand(sub => sub.setName('moeda').setDescription('Joga cara ou coroa.'))
    .addSubcommand(sub => sub
      .setName('dado').setDescription('Rola um dado.')
      .addIntegerOption(option => option.setName('lados').setDescription('Quantidade de lados, padrão 6.').setMinValue(2).setMaxValue(1000)))
    .addSubcommand(sub => sub
      .setName('escolher').setDescription('Escolhe aleatoriamente entre opções.')
      .addStringOption(option => option.setName('opcoes').setDescription('Separe as opções usando |').setRequired(true).setMaxLength(1000)))
    .addSubcommand(sub => sub
      .setName('emojificar').setDescription('Transforma letras em emojis.')
      .addStringOption(option => option.setName('texto').setDescription('Texto que será transformado.').setRequired(true).setMaxLength(250))),

  new SlashCommandBuilder()
    .setName('jogo')
    .setDescription('Minijogos do RochaSystem.')
    .addSubcommand(sub => sub
      .setName('ppt').setDescription('Joga pedra, papel e tesoura contra o RochaSystem.')
      .addStringOption(option => option.setName('jogada').setDescription('Sua jogada.').setRequired(true).addChoices(
        { name: 'Pedra', value: 'pedra' }, { name: 'Papel', value: 'papel' }, { name: 'Tesoura', value: 'tesoura' }
      )))
    .addSubcommand(sub => sub
      .setName('numero').setDescription('Tente adivinhar um número de 1 a 10.')
      .addIntegerOption(option => option.setName('numero').setDescription('Seu palpite.').setRequired(true).setMinValue(1).setMaxValue(10)))
    .addSubcommand(sub => sub
      .setName('par-ou-impar').setDescription('Joga par ou ímpar contra o RochaSystem.')
      .addStringOption(option => option.setName('escolha').setDescription('Par ou ímpar.').setRequired(true).addChoices(
        { name: 'Par', value: 'par' }, { name: 'Ímpar', value: 'impar' }
      ))
      .addIntegerOption(option => option.setName('numero').setDescription('Número de 0 a 10.').setRequired(true).setMinValue(0).setMaxValue(10))),

  new SlashCommandBuilder()
    .setName('nivel')
    .setDescription('Sistema de níveis e XP do RochaSystem.')
    .addSubcommand(sub => sub
      .setName('perfil').setDescription('Mostra o nível de um usuário.')
      .addUserOption(option => option.setName('usuario').setDescription('Usuário; vazio mostra seu perfil.')))
    .addSubcommand(sub => sub.setName('ranking').setDescription('Mostra o top 10 de XP do servidor.'))
    .addSubcommand(sub => sub.setName('ativar').setDescription('Ativa o ganho de XP por mensagens.'))
    .addSubcommand(sub => sub.setName('desativar').setDescription('Desativa o ganho de XP por mensagens.'))
    .addSubcommand(sub => sub
      .setName('configurar').setDescription('Configura XP mínimo, máximo e cooldown.')
      .addIntegerOption(option => option.setName('xp_minimo').setDescription('XP mínimo por mensagem.').setRequired(true).setMinValue(1).setMaxValue(100))
      .addIntegerOption(option => option.setName('xp_maximo').setDescription('XP máximo por mensagem.').setRequired(true).setMinValue(1).setMaxValue(250))
      .addIntegerOption(option => option.setName('cooldown').setDescription('Cooldown em segundos.').setRequired(true).setMinValue(5).setMaxValue(3600))),

  new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Backup e recuperação do RochaSystem.')
    .addSubcommand(sub => sub.setName('criar').setDescription('Cria um backup local imediatamente.'))
    .addSubcommand(sub => sub.setName('listar').setDescription('Lista os backups locais disponíveis.'))
    .addSubcommand(sub => sub.setName('exportar').setDescription('Exporta o banco atual em JSON.'))
    .addSubcommand(sub => sub
      .setName('restaurar').setDescription('Restaura um backup local. Exclusivo do Dono.')
      .addStringOption(option => option.setName('arquivo').setDescription('Nome exato retornado por /backup listar.').setRequired(true).setMaxLength(160)))
].map(builder => builder.toJSON());

async function registerExtraGuildCommands(guild) {
  for (const command of extraCommandData) {
    await guild.commands.create(command);
  }
  console.log(`✅ ${extraCommandData.length} grupos extras do RochaSystem registrados em ${guild.name}.`);
}

async function registerExtraAll(client) {
  for (const guild of client.guilds.cache.values()) {
    await registerExtraGuildCommands(guild).catch(error => console.error(`❌ Falha ao registrar comandos extras em ${guild.id}:`, error.message));
  }
}

module.exports = { extraCommandData, registerExtraGuildCommands, registerExtraAll };
