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
