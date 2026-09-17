const COMMAND_CATEGORIES = {
  dono: { label: 'Dono', emoji: '👑', description: 'Comandos exclusivos de controle do RochaSystem.' },
  administracao: { label: 'Administração', emoji: '🛠️', description: 'Gerenciamento de cargos, canais, mensagens e servidor.' },
  moderacao: { label: 'Moderação', emoji: '🛡️', description: 'Banimentos, expulsões, silenciamentos, advertências e ações disciplinares.' },
  configuracao: { label: 'Configuração', emoji: '⚙️', description: 'Configurações internas do RochaSystem.' },
  suporte: { label: 'Suporte', emoji: '🎧', description: 'Ferramentas destinadas à equipe de suporte.' },
  utilidades: { label: 'Utilidades', emoji: '🧰', description: 'Consultas e ferramentas gerais.' },
  pesquisa: { label: 'Pesquisa', emoji: '🔎', description: 'Comandos de consulta e pesquisa.' },
  diversao: { label: 'Diversão', emoji: '🎉', description: 'Comandos recreativos.' },
  jogos: { label: 'Jogos', emoji: '🎮', description: 'Minijogos e interações.' },
  niveis: { label: 'Níveis', emoji: '📈', description: 'Sistema de níveis e progressão.' },
  automod: { label: 'AutoMod', emoji: '🤖', description: 'Automoderação e filtros automáticos.' },
  backup: { label: 'Backup', emoji: '💾', description: 'Backup e recuperação de configurações.' },
  tickets: { label: 'Tickets', emoji: '🎫', description: 'Administração do sistema de tickets.' }
};

const COMMAND_CATALOG = [
  { id: 'ajuda', slash: 'ajuda', label: 'Ajuda', category: 'utilidades', description: 'Mostra os comandos liberados para você.' },

  { id: 'bot.perfil', slash: 'bot perfil', label: 'Ver perfil do bot', category: 'dono', ownerOnly: true },
  { id: 'bot.nome', slash: 'bot nome', label: 'Alterar nome do bot', category: 'dono', ownerOnly: true },
  { id: 'bot.bio', slash: 'bot bio', label: 'Alterar descrição do bot', category: 'dono', ownerOnly: true },
  { id: 'bot.avatar', slash: 'bot avatar', label: 'Alterar foto do bot', category: 'dono', ownerOnly: true },
  { id: 'bot.banner', slash: 'bot banner', label: 'Alterar banner do bot', category: 'dono', ownerOnly: true },
  { id: 'bot.status', slash: 'bot status', label: 'Alterar status/atividade do bot', category: 'dono', ownerOnly: true },

  { id: 'dono.servidores', slash: 'dono servidores', label: 'Listar servidores do bot', category: 'dono', ownerOnly: true },
  { id: 'dono.recarregar-comandos', slash: 'dono recarregar-comandos', label: 'Recarregar comandos', category: 'dono', ownerOnly: true },
  { id: 'dono.emojis', slash: 'dono emojis', label: 'Listar emojis do servidor', category: 'dono', ownerOnly: true },
  { id: 'dono.runtime', slash: 'dono runtime', label: 'Informações do processo', category: 'dono', ownerOnly: true },
  { id: 'dono.anunciar', slash: 'dono anunciar', label: 'Enviar anúncio', category: 'dono', ownerOnly: true },

  { id: 'admin.cargo-adicionar', slash: 'admin cargo-adicionar', label: 'Adicionar cargo', category: 'administracao' },
  { id: 'admin.cargo-remover', slash: 'admin cargo-remover', label: 'Remover cargo', category: 'administracao' },
  { id: 'admin.limpar', slash: 'admin limpar', label: 'Limpar mensagens', category: 'administracao' },
  { id: 'admin.canal-trancar', slash: 'admin canal-trancar', label: 'Trancar canal', category: 'administracao' },
  { id: 'admin.canal-destrancar', slash: 'admin canal-destrancar', label: 'Destrancar canal', category: 'administracao' },
  { id: 'admin.cargos', slash: 'admin cargos', label: 'Listar cargos', category: 'administracao' },
  { id: 'admin.embed', slash: 'admin embed', label: 'Criar embed', category: 'administracao' },
  { id: 'admin.emoji-buscar', slash: 'admin emoji-buscar', label: 'Buscar emoji', category: 'administracao' },

  { id: 'moderacao.banir', slash: 'moderacao banir', label: 'Banir usuário', category: 'moderacao' },
  { id: 'moderacao.expulsar', slash: 'moderacao expulsar', label: 'Expulsar usuário', category: 'moderacao' },
  { id: 'moderacao.silenciar', slash: 'moderacao silenciar', label: 'Silenciar usuário', category: 'moderacao' },
  { id: 'moderacao.dessilenciar', slash: 'moderacao dessilenciar', label: 'Remover silenciamento', category: 'moderacao' },
  { id: 'moderacao.advertir', slash: 'moderacao advertir', label: 'Advertir usuário', category: 'moderacao' },
  { id: 'moderacao.advertencias', slash: 'moderacao advertencias', label: 'Ver advertências', category: 'moderacao' },
  { id: 'moderacao.limpar-advertencias', slash: 'moderacao limpar-advertencias', label: 'Limpar advertências', category: 'moderacao' },
  { id: 'moderacao.remover-advertencia', slash: 'moderacao remover-advertencia', label: 'Remover uma advertência', category: 'moderacao' },

  { id: 'automod.ver', slash: 'automod ver', label: 'Ver AutoMod', category: 'automod' },
  { id: 'automod.ativar', slash: 'automod ativar', label: 'Ativar AutoMod', category: 'automod' },
  { id: 'automod.desativar', slash: 'automod desativar', label: 'Desativar AutoMod', category: 'automod' },
  { id: 'automod.adicionar-palavra', slash: 'automod adicionar-palavra', label: 'Bloquear palavra', category: 'automod' },
  { id: 'automod.remover-palavra', slash: 'automod remover-palavra', label: 'Liberar palavra', category: 'automod' },
  { id: 'automod.limpar-palavras', slash: 'automod limpar-palavras', label: 'Limpar filtro', category: 'automod' },

  { id: 'configuracao.ver', slash: 'configuracao ver', label: 'Ver configuração do sistema', category: 'configuracao' },
  { id: 'configuracao.auditoria', slash: 'configuracao auditoria', label: 'Configurar canal de auditoria', category: 'configuracao' },
  { id: 'configuracao.cor', slash: 'configuracao cor', label: 'Alterar cor principal', category: 'configuracao' },
  { id: 'configuracao.rodape', slash: 'configuracao rodape', label: 'Alterar rodapé', category: 'configuracao' },

  { id: 'utilidade.ping', slash: 'utilidade ping', label: 'Ver latência do bot', category: 'utilidades' },
  { id: 'utilidade.avatar', slash: 'utilidade avatar', label: 'Ver avatar', category: 'utilidades' },
  { id: 'utilidade.usuario', slash: 'utilidade usuario', label: 'Informações de usuário', category: 'utilidades' },
  { id: 'utilidade.servidor', slash: 'utilidade servidor', label: 'Informações do servidor', category: 'utilidades' },
  { id: 'utilidade.convite', slash: 'utilidade convite', label: 'Criar convite temporário', category: 'utilidades' },

  { id: 'pesquisa.github', slash: 'pesquisa github', label: 'Pesquisar GitHub', category: 'pesquisa' },
  { id: 'pesquisa.cargo', slash: 'pesquisa cargo', label: 'Pesquisar cargo', category: 'pesquisa' },
  { id: 'pesquisa.canal', slash: 'pesquisa canal', label: 'Pesquisar canal', category: 'pesquisa' },

  { id: 'diversao.oito-bola', slash: 'diversao oito-bola', label: 'Oito-bola', category: 'diversao' },
  { id: 'diversao.moeda', slash: 'diversao moeda', label: 'Cara ou coroa', category: 'diversao' },
  { id: 'diversao.dado', slash: 'diversao dado', label: 'Rolar dado', category: 'diversao' },
  { id: 'diversao.escolher', slash: 'diversao escolher', label: 'Escolher opção', category: 'diversao' },
  { id: 'diversao.emojificar', slash: 'diversao emojificar', label: 'Emojificar texto', category: 'diversao' },

  { id: 'jogo.ppt', slash: 'jogo ppt', label: 'Pedra, papel e tesoura', category: 'jogos' },
  { id: 'jogo.numero', slash: 'jogo numero', label: 'Adivinhar número', category: 'jogos' },
  { id: 'jogo.par-ou-impar', slash: 'jogo par-ou-impar', label: 'Par ou ímpar', category: 'jogos' },

  { id: 'nivel.perfil', slash: 'nivel perfil', label: 'Perfil de nível', category: 'niveis' },
  { id: 'nivel.ranking', slash: 'nivel ranking', label: 'Ranking de níveis', category: 'niveis' },
  { id: 'nivel.ativar', slash: 'nivel ativar', label: 'Ativar níveis', category: 'configuracao' },
  { id: 'nivel.desativar', slash: 'nivel desativar', label: 'Desativar níveis', category: 'configuracao' },
  { id: 'nivel.configurar', slash: 'nivel configurar', label: 'Configurar níveis', category: 'configuracao' },

  { id: 'backup.criar', slash: 'backup criar', label: 'Criar backup', category: 'backup' },
  { id: 'backup.listar', slash: 'backup listar', label: 'Listar backups', category: 'backup' },
  { id: 'backup.exportar', slash: 'backup exportar', label: 'Exportar backup', category: 'backup' },
  { id: 'backup.restaurar', slash: 'backup restaurar', label: 'Restaurar backup', category: 'backup', ownerOnly: true },

  { id: 'config', slash: 'config', label: 'Configurar RochaSystem', category: 'configuracao', ownerOnly: true },
  { id: 'painel', slash: 'painel', label: 'Publicar painel de tickets', category: 'tickets', ownerOnly: true },
  { id: 'preview', slash: 'preview', label: 'Central de prévias', category: 'configuracao', ownerOnly: true },
  { id: 'diagnostico', slash: 'diagnostico', label: 'Diagnóstico do sistema', category: 'configuracao', ownerOnly: true }
];

function commandById(id) {
  return COMMAND_CATALOG.find(command => command.id === id) || null;
}

function commandsForCategory(category) {
  return COMMAND_CATALOG.filter(command => command.category === category);
}

module.exports = {
  COMMAND_CATEGORIES,
  COMMAND_CATALOG,
  commandById,
  commandsForCategory
};
