function commandIdForSubcommand(subcommand) {
  return `jogo.${subcommand}`;
}

const moves = ['pedra', 'papel', 'tesoura'];
const beats = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' };

async function executeGames(interaction, subcommand) {
  if (subcommand === 'ppt') {
    const userMove = interaction.options.getString('jogada', true);
    const botMove = moves[Math.floor(Math.random() * moves.length)];
    let result = 'Empate!';
    if (userMove !== botMove) result = beats[userMove] === botMove ? 'Você venceu!' : 'RochaSystem venceu!';
    return interaction.editReply(`🎮 Você: **${userMove}** • RochaSystem: **${botMove}**\n**${result}**`);
  }

  if (subcommand === 'numero') {
    const guess = interaction.options.getInteger('numero', true);
    const number = 1 + Math.floor(Math.random() * 10);
    return interaction.editReply(guess === number
      ? `🎯 Acertou! O número era **${number}**.`
      : `❌ Não foi dessa vez. Você escolheu **${guess}** e o número era **${number}**.`);
  }

  if (subcommand === 'par-ou-impar') {
    const choice = interaction.options.getString('escolha', true);
    const userNumber = interaction.options.getInteger('numero', true);
    const botNumber = Math.floor(Math.random() * 11);
    const sum = userNumber + botNumber;
    const parity = sum % 2 === 0 ? 'par' : 'impar';
    const won = parity === choice;
    return interaction.editReply(`🎮 Você: **${userNumber}** • RochaSystem: **${botNumber}** • Total: **${sum} (${parity})**\n${won ? '✅ Você venceu!' : '❌ RochaSystem venceu!'}`);
  }

  throw new Error(`Subcomando de jogos não implementado: ${subcommand}`);
}

module.exports = { commandIdForSubcommand, executeGames };
