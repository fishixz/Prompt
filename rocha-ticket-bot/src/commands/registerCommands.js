const { SlashCommandBuilder, ChannelType } = require('discord.js');

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
      .addStringOption(option => option.setName('nome').setDescription('Novo nome do bot.').setRequired(true).setMinLength(2).setMaxLength(32)))
    .addSubcommand(sub => sub
      .setName('bio')
      .setDescription('Altera a descrição/Bio do bot. Exclusivo do Dono.')
      .addStringOption(option => option.setName('descricao').setDescription('Nova descrição da aplicação/bot.').setRequired(true).setMinLength(1).setMaxLength(400)))
    .addSubcommand(sub => sub
      .setName('avatar')
      .setDescription('Altera a foto do bot. Exclusivo do Dono.')
      .addAttachmentOption(option => option.setName('imagem').setDescription('Imagem que será usada como avatar.').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('banner')
      .setDescription('Altera o banner do bot. Exclusivo do Dono.')
      .addAttachmentOption(option => option.setName('imagem').setDescription('Imagem que será usada como banner.').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Altera o status e a atividade do bot. Exclusivo do Dono.')
      .addStringOption(option => option
        .setName('status').setDescription('Novo status do bot.').setRequired(true)
        .addChoices(
          { name: 'Online', value: 'online' },
          { name: 'Ausente', value: 'idle' },
          { name: 'Não perturbe', value: 'dnd' },
          { name: 'Invisível', value: 'invisible' }
        ))
      .addStringOption(option => option.setName('atividade').setDescription('Texto exibido como atividade do bot.').setRequired(false).setMaxLength(128))),

  new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Comandos de administração do RochaSystem.')
    .addSubcommand(sub => sub
      .setName('cargo-adicionar').setDescription('Adiciona um cargo a um membro.')
      .addUserOption(option => option.setName('usuario').setDescription('Membro que receberá o cargo.').setRequired(true))
      .addRoleOption(option => option.setName('cargo').setDescription('Cargo que será adicionado.').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo da alteração.').setMaxLength(500)))
    .addSubcommand(sub => sub
      .setName('cargo-remover').setDescription('Remove um cargo de um membro.')
      .addUserOption(option => option.setName('usuario').setDescription('Membro que perderá o cargo.').setRequired(true))
      .addRoleOption(option => option.setName('cargo').setDescription('Cargo que será removido.').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo da alteração.').setMaxLength(500)))
    .addSubcommand(sub => sub
      .setName('limpar').setDescription('Apaga mensagens recentes do canal.')
      .addIntegerOption(option => option.setName('quantidade').setDescription('Quantidade de mensagens, de 1 a 100.').setRequired(true).setMinValue(1).setMaxValue(100))
      .addUserOption(option => option.setName('usuario').setDescription('Opcional: apagar somente mensagens deste usuário.')))
    .addSubcommand(sub => sub
      .setName('canal-trancar').setDescription('Impede @everyone de enviar mensagens em um canal.')
      .addChannelOption(option => option.setName('canal').setDescription('Canal; vazio usa o canal atual.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand(sub => sub
      .setName('canal-destrancar').setDescription('Restaura as permissões normais de envio do canal.')
      .addChannelOption(option => option.setName('canal').setDescription('Canal; vazio usa o canal atual.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand(sub => sub.setName('cargos').setDescription('Lista os cargos e IDs do servidor.'))
    .addSubcommand(sub => sub
      .setName('embed').setDescription('Envia uma embed personalizada.')
      .addStringOption(option => option.setName('descricao').setDescription('Texto principal da embed.').setRequired(true).setMaxLength(4000))
      .addStringOption(option => option.setName('titulo').setDescription('Título opcional.').setMaxLength(256))
      .addStringOption(option => option.setName('cor').setDescription('Cor hexadecimal, ex.: #F5A300.').setMaxLength(7))
      .addChannelOption(option => option.setName('canal').setDescription('Canal de destino; vazio usa o atual.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand(sub => sub
      .setName('emoji-buscar').setDescription('Busca emojis do servidor pelo nome.')
      .addStringOption(option => option.setName('nome').setDescription('Nome ou parte do nome do emoji.').setRequired(true).setMaxLength(100))),

  new SlashCommandBuilder()
    .setName('moderacao')
    .setDescription('Comandos de moderação do RochaSystem.')
    .addSubcommand(sub => sub
      .setName('banir').setDescription('Bane um usuário do servidor.')
      .addUserOption(option => option.setName('usuario').setDescription('Usuário que será banido.').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo do banimento.').setMaxLength(1000))
      .addIntegerOption(option => option.setName('apagar_horas').setDescription('Apagar mensagens das últimas 0–168 horas.').setMinValue(0).setMaxValue(168)))
    .addSubcommand(sub => sub
      .setName('expulsar').setDescription('Expulsa um membro do servidor.')
      .addUserOption(option => option.setName('usuario').setDescription('Membro que será expulso.').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo da expulsão.').setMaxLength(1000)))
    .addSubcommand(sub => sub
      .setName('silenciar').setDescription('Aplica timeout em um membro.')
      .addUserOption(option => option.setName('usuario').setDescription('Membro que será silenciado.').setRequired(true))
      .addIntegerOption(option => option.setName('minutos').setDescription('Duração em minutos, máximo 28 dias.').setRequired(true).setMinValue(1).setMaxValue(40320))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo do silenciamento.').setMaxLength(1000)))
    .addSubcommand(sub => sub
      .setName('dessilenciar').setDescription('Remove o timeout de um membro.')
      .addUserOption(option => option.setName('usuario').setDescription('Membro que terá o timeout removido.').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo da remoção.').setMaxLength(1000)))
    .addSubcommand(sub => sub
      .setName('advertir').setDescription('Registra uma advertência no RochaSystem.')
      .addUserOption(option => option.setName('usuario').setDescription('Membro advertido.').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo da advertência.').setRequired(true).setMaxLength(1000)))
    .addSubcommand(sub => sub
      .setName('advertencias').setDescription('Mostra o histórico de advertências de um usuário.')
      .addUserOption(option => option.setName('usuario').setDescription('Usuário consultado.').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('limpar-advertencias').setDescription('Remove todas as advertências de um membro.')
      .addUserOption(option => option.setName('usuario').setDescription('Membro que terá as advertências removidas.').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo da limpeza.').setMaxLength(1000)))
    .addSubcommand(sub => sub
      .setName('remover-advertencia').setDescription('Remove uma advertência específica pelo ID.')
      .addUserOption(option => option.setName('usuario').setDescription('Membro da advertência.').setRequired(true))
      .addStringOption(option => option.setName('id').setDescription('ID exibido em /moderacao advertencias.').setRequired(true).setMaxLength(32))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo da remoção.').setMaxLength(1000)))
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
