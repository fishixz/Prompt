const fs = require('fs');
const readline = require('readline');
const { Client, GatewayIntentBits, Events, PermissionFlagsBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = '1545112032892690442';
const PROTECTED_ROLE_IDS = new Set([
  '1546580729193046086', // dono geral
  '1548874205079277668', // ︱👑
]);

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN não informado.');
  process.exit(1);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const sections = [
  { key: 'direction', name: '━━━━━━━━・👑 DIREÇÃO・━━━━━━━━', aliases: [], roleIds: ['1545125472512385035','1545818854825922560'] },
  { key: 'high', name: '━━━━━━━━・💼 ALTA GESTÃO・━━━━━━━━', aliases: ['━━━━━━・CARGOS ALTOS・━━━━━━'], roleIds: ['1545125375342936245','1548146654522114069','1548147086577500160','1545125194614710302','1548147521455390741','1545125017925328907'] },
  { key: 'admin', name: '━━━━━━━━・🛡️ ADMINISTRAÇÃO・━━━━━━━━', aliases: [], roleIds: ['1545366441161924689','1545368691993219122','1545124594174787605','1545124479062114425','1545124329208160276','1545123865707937883','1545934584972185731'] },
  { key: 'allowlist', name: '━━━━━━━━・📋 ALLOWLIST・━━━━━━━━', aliases: ['========= ALLOWLIST ========='], roleIds: ['1549705412851273748','1549701033855557632','1549696777945358428','1549707701989412874','1549701180165201950','1549707922483716146','1549699378749513789','1549699220452147291','1549708783842889879'] },
  { key: 'leaders', name: '━━━━━━━━・👑 LÍDERES・━━━━━━━━', aliases: ['━━━━━━・LÍDERES・━━━━━━'], roleIds: ['1545924779180032161','1545924968351531068','1545924565060947978'] },
  { key: 'corporations', name: '━━━━━━━━・🏛️ CORPORAÇÕES・━━━━━━━━', aliases: ['━━━━━━・CORPORAÇÃO・━━━━━━'], roleIds: ['1549698702287970345','1545915334681436192','1545920423244599447','1549702479342477342','1549989193680293968'] },
  { key: 'factions', name: '━━━━━━━━・🔫 FACÇÕES・━━━━━━━━', aliases: ['━━━━━━・FACÇÃO・━━━━━━'], roleIds: ['1545917124722032751','1545919143310524507','1545919340308865104','1545945712942915655','1545919452741243020'] },
  { key: 'teams', name: '━━━━━━━━・👥 EQUIPES・━━━━━━━━', aliases: ['━━━━━━・EQUIPES・━━━━━━'], roleIds: ['1549698507525333002','1549699577479696495','1549699724523872317','1549699644634832907','1549699504393949214','1549699041082875995','1549989223074111598','1549989385657647284','1549989402661359738'] },
  { key: 'media', name: '━━━━━━━━・📢 MÍDIA E EVENTOS・━━━━━━━━', aliases: ['========= INFLUENCER ========='], roleIds: ['1549704499482853416','1549698935101333594','1549989266199945276','1545950869323907122','1545950678797647952','1549989189456760842','1549989214630711399'] },
  { key: 'organizations', name: '━━━━━━━━・🏙️ ORGANIZAÇÕES・━━━━━━━━', aliases: [], roleIds: ['1549989058653061140','1549989202048061451','1549989231454322688','1549989198012878898','1549989377420169216','1549989406834688120','1549989410970533990'] },
  { key: 'benefits', name: '━━━━━━━━・💎 BENEFÍCIOS・━━━━━━━━', aliases: [], roleIds: ['1549989279139373076','1549989326513905714','1549989330817388645','1549989394130403349','1549989314010677258','1549989318204854303'] },
  { key: 'vips', name: "━━━━━━━━・💰 VIP'S・━━━━━━━━", aliases: ["━━━━━━・VIP'S・━━━━━━"], roleIds: ['1549989419593768970','1549989424538976337','1549989428838006784','1549989433057480754','1549989441689489428','1549989446596689960'] },
  { key: 'population', name: '━━━━━━━━・👤 POPULAÇÃO・━━━━━━━━', aliases: ['========= POPULAÇÃO ========='], roleIds: ['1545924760507256912','1545123573763543091','1549708570671718410','1549700889529290782','1549989369056862279'] },
  { key: 'moderation', name: '━━━━━━━━・⚖️ MODERAÇÃO・━━━━━━━━', aliases: [], roleIds: ['1549989045734608896','1549989100705292308','1549989071374393414','1549700509441720320','1549700659740278854','1549700779726602270','1549989088181096559'] },
  { key: 'development', name: '━━━━━━━━・💻 DESENVOLVIMENTO・━━━━━━━━', aliases: [], roleIds: ['1545125938818449478','1549704866786705478','1549989176718528574','1549989125870854234','1549989296507985940','1549989300714602536','1549989309237567528'] },
];

const BOTS_SEPARATOR = { key: 'bots', name: '━━━━━━━━・🤖 BOTS・━━━━━━━━', aliases: [] };
const INTERNAL_SEPARATOR = { key: 'internal', name: '━━━━━━━━・🔒 INTERNOS・━━━━━━━━', aliases: ['======= DEMAIS CARGOS ======='] };

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function exportRoles(guild) {
  return [...guild.roles.cache.values()]
    .sort((a, b) => b.position - a.position)
    .map((role, index) => ({
      order: index + 1,
      name: role.name,
      id: role.id,
      position: role.position,
      rawPosition: role.rawPosition,
      color: role.hexColor,
      managed: role.managed,
      editable: role.editable,
      mentionable: role.mentionable,
      hoist: role.hoist,
      isEveryone: role.id === guild.id,
    }));
}

async function ensureSeparator(guild, config) {
  await guild.roles.fetch();

  const exact = [...guild.roles.cache.values()]
    .filter((r) => r.name === config.name && !r.managed)
    .sort((a, b) => b.position - a.position)[0];

  if (exact) {
    console.log(`  ♻️ Encontrado: ${config.name}`);
    return exact;
  }

  for (const alias of config.aliases || []) {
    const candidate = [...guild.roles.cache.values()]
      .filter((r) => r.name === alias && !r.managed)
      .sort((a, b) => b.position - a.position)[0];

    if (candidate && candidate.editable) {
      await candidate.edit({ name: config.name, hoist: false, mentionable: false, reason: 'Organização de cargos Rocha Roleplay' });
      console.log(`  ♻️ Renomeado: ${alias} -> ${config.name}`);
      return candidate;
    }
  }

  const created = await guild.roles.create({
    name: config.name,
    permissions: [],
    hoist: false,
    mentionable: false,
    reason: 'Separador da organização de cargos Rocha Roleplay',
  });
  console.log(`  ➕ Criado: ${config.name}`);
  return created;
}

function canMove(role, botRole, guild) {
  return Boolean(
    role &&
    role.id !== guild.id &&
    role.id !== botRole.id &&
    !PROTECTED_ROLE_IDS.has(role.id) &&
    !role.managed &&
    role.editable &&
    role.position < botRole.position
  );
}

async function moveDirectlyBelowBot(role, botRoleId, guild) {
  await guild.roles.fetch();
  const freshRole = guild.roles.cache.get(role.id);
  const freshBotRole = guild.roles.cache.get(botRoleId);

  if (!canMove(freshRole, freshBotRole, guild)) {
    console.log(`  ↪️ PULADO: ${freshRole?.name || role.name}`);
    return false;
  }

  try {
    await freshRole.setPosition(freshBotRole.position - 1, { reason: 'Organização de cargos Rocha Roleplay' });
    console.log(`  ✅ ${freshRole.name}`);
    await wait(350);
    return true;
  } catch (error) {
    console.log(`  ❌ PULADO: ${freshRole.name} | ${error.message}${error.code ? ` | código ${error.code}` : ''}`);
    return false;
  }
}

async function moveToBottom(role, botRoleId, guild) {
  await guild.roles.fetch();
  const freshRole = guild.roles.cache.get(role.id);
  const freshBotRole = guild.roles.cache.get(botRoleId);

  if (!canMove(freshRole, freshBotRole, guild)) {
    console.log(`  ↪️ PULADO: ${freshRole?.name || role.name}`);
    return false;
  }

  try {
    await freshRole.setPosition(1, { reason: 'Organização de cargos Rocha Roleplay - Internos' });
    console.log(`  ✅ ${freshRole.name}`);
    await wait(350);
    return true;
  } catch (error) {
    console.log(`  ❌ PULADO: ${freshRole.name} | ${error.message}${error.code ? ` | código ${error.code}` : ''}`);
    return false;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  try {
    console.log(`\n✅ Conectado como ${readyClient.user.tag}`);

    const guild = await readyClient.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();
    console.log(`🏠 Servidor: ${guild.name}`);

    const me = guild.members.me || await guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('O bot não possui a permissão Gerenciar Cargos.');
    }

    const botRole = me.roles.highest;
    const botRoleId = botRole.id;
    console.log(`🤖 Cargo mais alto do bot: ${botRole.name} | posição ${botRole.position}`);

    console.log('\n🛡️ Protegidos e intocados:');
    for (const id of PROTECTED_ROLE_IDS) {
      const role = guild.roles.cache.get(id);
      if (role) console.log(`  - ${role.name} | posição ${role.position}`);
    }

    const illegalAbove = [...guild.roles.cache.values()].filter((role) =>
      role.id !== botRoleId &&
      role.id !== guild.id &&
      !PROTECTED_ROLE_IDS.has(role.id) &&
      role.position >= botRole.position
    );

    if (illegalAbove.length) {
      console.error('\n❌ Existem cargos não protegidos no mesmo nível ou acima do Orga:');
      for (const role of illegalAbove) console.error(`  - ${role.name} | posição ${role.position}`);
      console.error('Mova apenas esses cargos para baixo do Orga e execute novamente.');
      process.exitCode = 1;
      return;
    }

    const backupFile = `roles-backup-${Date.now()}.json`;
    fs.writeFileSync(backupFile, JSON.stringify({ generatedAt: new Date().toISOString(), guild: { id: guild.id, name: guild.name }, roles: exportRoles(guild) }, null, 2), 'utf8');
    console.log(`\n💾 Backup salvo em: ${backupFile}`);

    console.log('\n🔧 Conferindo separadores...');
    const separatorMap = new Map();
    for (const section of sections) separatorMap.set(section.key, await ensureSeparator(guild, section));
    separatorMap.set('bots', await ensureSeparator(guild, BOTS_SEPARATOR));
    separatorMap.set('internal', await ensureSeparator(guild, INTERNAL_SEPARATOR));

    await guild.roles.fetch();

    const usedIds = new Set([guild.id, botRoleId, ...PROTECTED_ROLE_IDS, ...[...separatorMap.values()].map((r) => r.id)]);
    const mainOrder = [];
    const missing = [];

    for (const section of sections) {
      const separator = guild.roles.cache.get(separatorMap.get(section.key).id);
      if (separator) mainOrder.push(separator);

      for (const id of section.roleIds) {
        const role = guild.roles.cache.get(id);
        if (!role) {
          missing.push(id);
          continue;
        }
        usedIds.add(role.id);
        if (!role.managed) mainOrder.push(role);
      }
    }

    const botsSeparator = guild.roles.cache.get(separatorMap.get('bots').id);
    if (botsSeparator) mainOrder.push(botsSeparator);

    const managedBelowBot = [...guild.roles.cache.values()]
      .filter((role) => role.managed && role.id !== botRoleId && role.position < guild.roles.cache.get(botRoleId).position)
      .sort((a, b) => b.position - a.position);

    const leftovers = [...guild.roles.cache.values()]
      .filter((role) => role.id !== guild.id && role.id !== botRoleId && !PROTECTED_ROLE_IDS.has(role.id) && !role.managed && !usedIds.has(role.id))
      .sort((a, b) => b.position - a.position);

    const internalSeparator = guild.roles.cache.get(separatorMap.get('internal').id);
    const internalOrder = [internalSeparator, ...leftovers].filter(Boolean);

    console.log('\n📋 Plano seguro:');
    console.log(`  • ${mainOrder.length} cargos/separadores serão organizados acima.`);
    console.log(`  • ${managedBelowBot.length} cargos managed serão preservados sem edição direta.`);
    console.log(`  • ${leftovers.length} cargos legados/duplicados irão para INTERNOS.`);
    console.log('  • dono geral, ︱👑, Orga e @everyone não serão movidos.');
    if (missing.length) console.log(`  ⚠️ ${missing.length} IDs da estrutura não existem mais e serão ignorados.`);

    const confirmation = await ask('\nDigite ORGANIZAR para aplicar: ');
    if (confirmation !== 'ORGANIZAR') {
      console.log('❎ Cancelado. Nenhum cargo foi reposicionado.');
      return;
    }

    console.log('\n⬆️ Organizando estrutura principal abaixo do Orga...');
    for (const role of [...mainOrder].reverse()) {
      await moveDirectlyBelowBot(role, botRoleId, guild);
    }

    console.log('\n⬇️ Movendo cargos legados/duplicados para o bloco INTERNOS...');
    for (const role of internalOrder) {
      await moveToBottom(role, botRoleId, guild);
    }

    await guild.roles.fetch();
    fs.writeFileSync('roles-organized.json', JSON.stringify({ generatedAt: new Date().toISOString(), guild: { id: guild.id, name: guild.name }, roles: exportRoles(guild) }, null, 2), 'utf8');

    console.log('\n✅ ORGANIZAÇÃO FINALIZADA.');
    console.log('📄 Estrutura final salva em: roles-organized.json');
    console.log('💾 O backup original continua salvo no diretório.');
    console.log('ℹ️ Cargos managed não são editados diretamente pelo script.');
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    if (error.code) console.error('Código:', error.code);
    if (error.rawError) console.error(error.rawError);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.on('error', (error) => console.error('Erro do cliente Discord:', error));
client.login(TOKEN).catch((error) => {
  console.error('❌ Falha ao entrar no Discord:', error.message);
  process.exit(1);
});
