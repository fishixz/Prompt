require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  Events
} = require('discord.js');
const { registerAll, registerGuildCommands } = require('./commands/registerCommands');
const { interactionCreate } = require('./handlers/interactionCreate');
const {
  dueTicketCleanup,
  reconcileTickets,
  markChannelDeleted
} = require('./services/ticketService');
const { syncAllGuildPermissions } = require('./services/permissionSyncService');
const { createRollingBackup } = require('./services/backupService');
const { getState } = require('./database/store');

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
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`\n✅ Rocha Ticket conectado como ${readyClient.user.tag}`);
  console.log(`🏠 Servidores: ${readyClient.guilds.cache.size}`);
  readyClient.user.setActivity('Tickets • Rocha Roleplay', { type: ActivityType.Watching });

  await getState();

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
  if (permissionSync) {
    console.log(`🔐 Permissões sincronizadas em ${permissionSync.tickets} ticket(s).`);
  }

  const backup = await createRollingBackup({ keep: 7 }).catch(error => {
    console.error('❌ Falha ao criar backup inicial:', error);
    return null;
  });
  if (backup) console.log(`💾 Backup automático criado: ${backup.filePath}`);

  await registerAll(readyClient);
  await runMaintenance(readyClient);

  setInterval(() => runMaintenance(readyClient), 60_000).unref();
  setInterval(() => syncAllGuildPermissions(readyClient).catch(error => console.error('Permission sync:', error)), 5 * 60_000).unref();
  setInterval(() => createRollingBackup({ keep: 7 }).catch(error => console.error('Automatic backup:', error)), 24 * 60 * 60_000).unref();
});

client.on(Events.GuildCreate, guild => registerGuildCommands(guild));
client.on(Events.ChannelDelete, channel => markChannelDeleted(channel.id).catch(error => console.error('Channel delete reconciliation:', error)));
client.on(Events.InteractionCreate, interactionCreate);
client.on(Events.Error, error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

client.login(token);
