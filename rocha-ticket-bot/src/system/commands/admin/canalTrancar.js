const { PermissionFlagsBits } = require('discord.js');
const { assertBotPermission } = require('../../../services/moderationGuard');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const channel = interaction.options.getChannel('canal') || interaction.channel;
  if (!channel?.permissionOverwrites || !channel?.isTextBased?.()) throw new Error('Escolha um canal de texto que possua permissões editáveis.');
  assertBotPermission(interaction, PermissionFlagsBits.ManageChannels, 'Gerenciar Canais');

  await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
    SendMessages: false,
    AddReactions: false,
    SendMessagesInThreads: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false
  }, { reason: `RochaSystem • canal trancado por ${interaction.user.tag}` });

  await sendSystemAudit(interaction.guild, {
    action: 'Canal trancado',
    actor: interaction.user,
    details: `Canal: ${channel} (\`${channel.id}\`)`
  });
  return interaction.editReply(`🔒 ${channel} foi trancado para o cargo @everyone.`);
}

module.exports = { id: 'admin.canal-trancar', execute };
