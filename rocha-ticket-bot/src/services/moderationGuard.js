const { PermissionFlagsBits } = require('discord.js');

function rolePosition(member) {
  return member?.roles?.highest?.position ?? -1;
}

function actorIsGuildOwner(interaction) {
  return interaction.guild?.ownerId === interaction.user.id;
}

function assertBotPermission(interaction, permission, label) {
  const me = interaction.guild?.members?.me;
  if (!me?.permissions?.has(permission)) {
    throw new Error(`O RochaSystem precisa da permissão **${label}** para executar esta ação.`);
  }
}

function assertCanModerate(interaction, targetMember, options = {}) {
  const { allowSelf = false, checkBotHierarchy = true } = options;
  if (!targetMember) throw new Error('Esse usuário não está no servidor ou não pôde ser localizado como membro.');

  if (!allowSelf && targetMember.id === interaction.user.id) throw new Error('Você não pode aplicar esta ação em si mesmo.');
  if (targetMember.id === interaction.client.user.id) throw new Error('Não posso aplicar esta ação em mim mesmo.');
  if (targetMember.id === interaction.guild.ownerId) throw new Error('O dono do servidor não pode ser moderado por este comando.');

  if (!actorIsGuildOwner(interaction) && rolePosition(targetMember) >= rolePosition(interaction.member)) {
    throw new Error('Você só pode agir sobre membros com cargo abaixo do seu cargo mais alto.');
  }

  if (checkBotHierarchy) {
    const me = interaction.guild.members.me;
    if (me && rolePosition(targetMember) >= rolePosition(me)) {
      throw new Error('Meu cargo precisa ficar acima do cargo mais alto do usuário alvo.');
    }
  }

  return true;
}

function assertRoleManageable(interaction, role) {
  if (!role) throw new Error('Cargo não encontrado.');
  if (role.id === interaction.guild.id) throw new Error('O cargo @everyone não pode ser alterado por este comando.');
  if (role.managed) throw new Error('Esse cargo é gerenciado por integração/bot e não pode ser atribuído manualmente.');

  const me = interaction.guild.members.me;
  if (me && role.position >= rolePosition(me)) throw new Error('Meu cargo precisa ficar acima do cargo que você quer gerenciar.');
  if (!actorIsGuildOwner(interaction) && role.position >= rolePosition(interaction.member)) {
    throw new Error('Você só pode gerenciar cargos abaixo do seu cargo mais alto.');
  }
  return true;
}

module.exports = {
  assertBotPermission,
  assertCanModerate,
  assertRoleManageable,
  actorIsGuildOwner,
  rolePosition,
  PermissionFlagsBits
};
