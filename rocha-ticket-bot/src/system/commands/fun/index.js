const RESPONSES_8BALL = [
  'Sim.', 'Não.', 'Provavelmente sim.', 'Provavelmente não.', 'Com certeza.',
  'Melhor não contar com isso.', 'Os sinais apontam que sim.', 'Pergunte novamente mais tarde.'
];

function commandIdForSubcommand(subcommand) {
  return `diversao.${subcommand}`;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function emojify(text) {
  const map = {
    a: '🇦', b: '🇧', c: '🇨', d: '🇩', e: '🇪', f: '🇫', g: '🇬', h: '🇭', i: '🇮',
    j: '🇯', k: '🇰', l: '🇱', m: '🇲', n: '🇳', o: '🇴', p: '🇵', q: '🇶', r: '🇷',
    s: '🇸', t: '🇹', u: '🇺', v: '🇻', w: '🇼', x: '🇽', y: '🇾', z: '🇿'
  };
  return [...String(text || '').toLowerCase()].map(char => map[char] || char).join(' ').slice(0, 1900);
}

async function executeFun(interaction, subcommand) {
  if (subcommand === 'oito-bola') {
    const pergunta = interaction.options.getString('pergunta', true);
    return interaction.editReply(`🎱 **Pergunta:** ${pergunta}\n**Resposta:** ${randomItem(RESPONSES_8BALL)}`);
  }

  if (subcommand === 'moeda') {
    return interaction.editReply(`🪙 A moeda caiu em **${Math.random() < 0.5 ? 'Cara' : 'Coroa'}**.`);
  }

  if (subcommand === 'dado') {
    const lados = interaction.options.getInteger('lados') || 6;
    const value = 1 + Math.floor(Math.random() * lados);
    return interaction.editReply(`🎲 Você rolou um dado de **${lados} lados** e tirou **${value}**.`);
  }

  if (subcommand === 'escolher') {
    const raw = interaction.options.getString('opcoes', true);
    const options = raw.split('|').map(item => item.trim()).filter(Boolean).slice(0, 30);
    if (options.length < 2) throw new Error('Informe pelo menos duas opções separadas por `|`.');
    return interaction.editReply(`🎯 Eu escolho: **${randomItem(options)}**`);
  }

  if (subcommand === 'emojificar') {
    const text = interaction.options.getString('texto', true);
    return interaction.editReply(emojify(text) || '❌ Não consegui transformar esse texto.');
  }

  throw new Error(`Subcomando de diversão não implementado: ${subcommand}`);
}

module.exports = { commandIdForSubcommand, executeFun, emojify };
