const { PermissionFlagsBits } = require('discord.js');
const { assertBotPermission } = require('../../../services/moderationGuard');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const channel = interaction.options.getChannel('canal') || interaction.channel;
  if (!channel?.permissionOverwrites || !channel?.isTextBased?.()) throw new Error('Escolha um canal de texto que possua permissões editáveis.');
  assertBotPermission(interaction, PermissionFlagsBits.ManageChannels, 'Gerenciar Canais');

  await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
    SendMessages: null,
    AddReactions: null,
    SendMessagesInThreads: null,
    CreatePublicThreads: null,
    CreatePrivateThreads: null
  }, { reason: `RochaSystem • canal destrancado por ${interaction.user.tag}` });

  await sendSystemAudit(interaction.guild, {
    action: 'Canal destrancado',
    actor: interaction.user,
    details: `Canal: ${channel} (\`${channel.id}\`)`
  });
  return interaction.editReply(`🔓 ${channel} foi destrancado para herdar as permissões normais.`);
}

module.exports = { id: 'admin.canal-destrancar', execute };
