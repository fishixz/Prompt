const { MessageFlags } = require('discord.js');
const { isSystemOwner } = require('../services/accessControlService');
const { execute } = require('../system/commands/update');

async function handleUpdateCommand(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: 'Use este comando dentro de um servidor.', flags: MessageFlags.Ephemeral });
  }

  if (!await isSystemOwner(interaction)) {
    return interaction.reply({
      content: '⛔ O `/update` é exclusivo do cargo **Dono** do RochaSystem.',
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  return execute(interaction);
}

module.exports = { handleUpdateCommand };
