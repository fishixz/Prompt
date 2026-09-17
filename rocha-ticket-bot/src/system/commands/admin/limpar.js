const { PermissionFlagsBits } = require('discord.js');
const { assertBotPermission } = require('../../../services/moderationGuard');
const { sendSystemAudit } = require('../../../services/systemAuditService');

async function execute(interaction) {
  const amount = interaction.options.getInteger('quantidade', true);
  const target = interaction.options.getUser('usuario');
  const channel = interaction.channel;

  if (!channel?.isTextBased() || !channel.messages) throw new Error('Este comando só funciona em canais de texto compatíveis.');
  assertBotPermission(interaction, PermissionFlagsBits.ManageMessages, 'Gerenciar Mensagens');

  let deleted;
  if (!target) {
    deleted = await channel.bulkDelete(amount, true);
  } else {
    const fetched = await channel.messages.fetch({ limit: 100 });
    const selected = fetched.filter(message => message.author.id === target.id).first(amount);
    if (!selected.length) return interaction.editReply(`⚠️ Não encontrei mensagens recentes de ${target} para apagar.`);
    deleted = await channel.bulkDelete(selected, true);
  }

  const count = deleted?.size || 0;
  await sendSystemAudit(interaction.guild, {
    action: 'Mensagens apagadas',
    actor: interaction.user,
    target: target || null,
    details: `Canal: ${channel} • Solicitadas: ${amount} • Apagadas: ${count}`
  });

  return interaction.editReply(`✅ **${count}** mensagem(ns) recente(s) apagada(s)${target ? ` de ${target}` : ''}.`);
}

module.exports = { id: 'admin.limpar', execute };
