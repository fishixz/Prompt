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
const { syncStaffRolePermissions } = require('./services/permissionSyncService');
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

async function syncAllGuildPermissions(clientInstance) {
  for (const guild of clientInstance.guilds.cache.values()) {
    await syncStaffRolePermissions(guild).catch(error =>
      console.error(`Falha ao sincronizar permissões em ${guild.id}:`, error)
    );
  }
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

  await syncAllGuildPermissions(readyClient);
  await registerAll(readyClient);
  await dueTicketCleanup(readyClient).catch(console.error);

  setInterval(() => dueTicketCleanup(readyClient).catch(console.error), 60_000).unref();
  // Reaplica/remova overwrites de cargos periodicamente para que mudanças no /config
  // também alcancem tickets que já estavam abertos.
  setInterval(() => syncAllGuildPermissions(readyClient), 5 * 60_000).unref();
});

client.on(Events.GuildCreate, async guild => {
  await registerGuildCommands(guild);
  await syncStaffRolePermissions(guild).catch(() => null);
});
client.on(Events.ChannelDelete, channel => markChannelDeleted(channel.id).catch(error => console.error('Channel delete reconciliation:', error)));
client.on(Events.InteractionCreate, interactionCreate);
client.on(Events.Error, error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

client.login(token);
