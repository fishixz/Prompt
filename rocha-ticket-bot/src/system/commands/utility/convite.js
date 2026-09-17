const { PermissionFlagsBits } = require('discord.js');

async function execute(interaction) {
  const channel = interaction.options.getChannel('canal') || interaction.channel;
  if (!channel?.isTextBased?.()) throw new Error('Escolha um canal de texto válido.');
  const perms = channel.permissionsFor(interaction.guild.members.me);
  if (!perms?.has(PermissionFlagsBits.CreateInstantInvite)) {
    throw new Error('O RochaSystem precisa da permissão **Criar Convite** nesse canal.');
  }

  const invite = await channel.createInvite({
    maxAge: 3600,
    maxUses: 0,
    unique: true,
    reason: `RochaSystem • solicitado por ${interaction.user.tag}`
  });
  return interaction.editReply(`🔗 Convite válido por **1 hora**: ${invite.url}`);
}

module.exports = { id: 'utilidade.convite', execute };
