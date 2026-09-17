async function execute(interaction) {
  const gateway = Math.round(interaction.client.ws.ping);
  const interactionLatency = Date.now() - interaction.createdTimestamp;
  return interaction.editReply(`🏓 **Pong!** Gateway: **${gateway}ms** • Interação: **${interactionLatency}ms**`);
}

module.exports = { id: 'utilidade.ping', execute };
