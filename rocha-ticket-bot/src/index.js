require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType
} = require('discord.js');
const { registerAll, registerGuildCommands } = require('./commands/registerCommands');
const { interactionCreate } = require('./handlers/interactionCreate');
const { dueTicketCleanup } = require('./services/ticketService');
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

client.once('ready', async () => {
  console.log(`\n✅ Rocha Ticket conectado como ${client.user.tag}`);
  console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
  client.user.setActivity('Tickets • Rocha Roleplay', { type: ActivityType.Watching });
  await getState();
  await registerAll(client);
  await dueTicketCleanup(client).catch(console.error);
  setInterval(() => dueTicketCleanup(client).catch(console.error), 60_000).unref();
});

client.on('guildCreate', guild => registerGuildCommands(guild));
client.on('interactionCreate', interactionCreate);
client.on('error', error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

client.login(token);
