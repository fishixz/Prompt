require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  Events,
  MessageFlags
} = require('discord.js');
const { registerAllSystemCommands, registerGuildSystemCommands } = require('./commands/allCommands');
const { interactionCreate } = require('./handlers/interactionCreate');
const { handleUpdateCommand } = require('./handlers/updateHandler');
const {
  dueTicketCleanup,
  reconcileTickets,
  markChannelDeleted
} = require('./services/ticketService');
const { syncAllGuildPermissions } = require('./services/permissionSyncService');
const { createRollingBackup } = require('./services/backupService');
const { pruneRuntimeState } = require('./services/maintenanceService');
const { applySystemIdentity } = require('./services/botIdentityService');
const { handleAutomodMessage } = require('./services/automodService');
const { handleLevelMessage } = require('./services/levelService');
const { startAutoUpdateLoop } = require('./services/updateService');
const { getState, getGuildConfig } = require('./database/store');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN não encontrado. Execute ./install-termux.sh ou crie o arquivo .env.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

async function runMaintenance(readyClient) {
  await dueTicketCleanup(readyClient).catch(error => console.error('Ticket cleanup:', error));
  await pruneRuntimeState().catch(error => console.error('Runtime state cleanup:', error));
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`\n✅ RochaSystem conectado como ${readyClient.user.tag}`);
  console.log(`🏠 Servidores: ${readyClient.guilds.cache.size}`);

  await getState();

  const primaryGuild = readyClient.guilds.cache.first();
  if (primaryGuild) {
    const config = await getGuildConfig(primaryGuild.id);
    const identity = await applySystemIdentity(readyClient, config);
    if (identity.errors.length) console.warn(`⚠️ Identidade do RochaSystem: ${identity.errors.join(' | ')}`);
    else console.log('🦊 Identidade RochaSystem aplicada.');
  } else {
    readyClient.user.setActivity('RochaSystem • Rocha Roleplay', { type: ActivityType.Watching });
  }

  const reconciliation = await reconcileTickets(readyClient).catch(error => {
    console.error('❌ Falha na reconciliação inicial:', error);
    return null;
  });
  if (reconciliation) {
    console.log(`🧹 Reconciliação: ${reconciliation.orphaned} órfão(s), ${reconciliation.recoveredClosing} fechamento(s) recuperado(s), ${reconciliation.missingCalls} call(s) ausente(s).`);
  }

  const permissionSync = await syncAllGuildPermissions(readyClient).catch(error => {
    console.error('❌ Falha na sincronização inicial de permissões:', error);
    return null;
  });
  if (permissionSync) console.log(`🔐 Permissões sincronizadas em ${permissionSync.tickets} ticket(s).`);

  const backup = await createRollingBackup({ keep: 7 }).catch(error => {
    console.error('❌ Falha ao criar backup inicial:', error);
    return null;
  });
  if (backup) console.log(`💾 Backup automático criado: ${backup.filePath}`);

  await registerAllSystemCommands(readyClient);
  await runMaintenance(readyClient);
  startAutoUpdateLoop();

  setInterval(() => runMaintenance(readyClient), 60_000).unref();
  setInterval(() => syncAllGuildPermissions(readyClient).catch(error => console.error('Permission sync:', error)), 5 * 60_000).unref();
  setInterval(() => createRollingBackup({ keep: 7 }).catch(error => console.error('Automatic backup:', error)), 24 * 60 * 60_000).unref();
});

client.on(Events.GuildCreate, guild => registerGuildSystemCommands(guild).catch(error => console.error('Guild command registration:', error)));
client.on(Events.ChannelDelete, channel => markChannelDeleted(channel.id).catch(error => console.error('Channel delete reconciliation:', error)));
client.on(Events.MessageCreate, async message => {
  try {
    const blocked = await handleAutomodMessage(message);
    if (!blocked) await handleLevelMessage(message);
  } catch (error) {
    console.error('Message systems error:', error);
  }
});
client.on(Events.InteractionCreate, interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'update') return;
  handleUpdateCommand(interaction).catch(async error => {
    console.error('Update command error:', error);
    const content = `❌ Falha no sistema de atualização.\n\`${String(error.message || error).slice(0, 1500)}\``;
    if (interaction.deferred) await interaction.editReply(content).catch(() => null);
    else if (!interaction.replied) await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
  });
});
client.on(Events.InteractionCreate, interactionCreate);
client.on(Events.Error, error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

client.login(token);
