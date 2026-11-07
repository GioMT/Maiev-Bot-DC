import 'dotenv/config';
import { createDiscordClient } from './core/client.js';
import { createWebServer } from './core/server.js';
import { setupSseStream } from './core/sse.js';
import { CommandRegistry } from './core/command-registry.js';
import { InteractionRouter } from './core/interaction-router.js';
import { loadFeatures } from './core/feature-loader.js';
import { eventBus } from './core/event-bus.js';
import { configStore } from './core/storage/config-store.js';

// Feature Plugins
import { rulesFeature } from './features/rules/index.js';
import { verificationFeature } from './features/verification/index.js';
import { threadVerificationFeature } from './features/thread-verification/index.js';
import { welcomeFeature } from './features/welcome/index.js';
import { reactionRolesFeature } from './features/reaction-roles/index.js';
import { bossTimerFeature } from './features/boss-timer/index.js';
import { alertsFeature } from './features/alerts/index.js';
import { statusFeature } from './features/status/index.js';

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID
} = process.env;

const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.warn('\n⚠️ NOTICE: DISCORD_TOKEN or CLIENT_ID is not configured in .env file.');
  console.warn(`👉 Starting Web Control Center in local standalone mode on port ${PORT} for preview and configuration.\n`);
}

// 1. Initialize Core Kernel
const client = createDiscordClient();
const app = createWebServer();
const router = new InteractionRouter();
const commandRegistry = new CommandRegistry();

// 2. Mount Real-time SSE Stream (/api/events)
setupSseStream(app);

// 3. Load All Feature Modules
const context = {
  client,
  app,
  router,
  commandRegistry,
  eventBus,
  configStore
};

loadFeatures([
  rulesFeature,
  verificationFeature,
  threadVerificationFeature,
  welcomeFeature,
  reactionRolesFeature,
  bossTimerFeature,
  alertsFeature,
  statusFeature
], context);

// 4. Discord Ready Lifecycle
client.once('ready', async () => {
  console.log(`🤖 Maiev Bot logged in as ${client.user.tag}!`);
  console.log(`📡 Connected to ${client.guilds.cache.size} guild(s).`);
  await commandRegistry.registerAll({
    token: DISCORD_TOKEN,
    clientId: CLIENT_ID,
    guildId: GUILD_ID
  });
});

// 5. Start Web Control Center
export const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web Control Center listening on http://localhost:${PORT}`);
  console.log('👉 Ready for connections!');
});

// 6. Connect to Discord Gateway
if (DISCORD_TOKEN) {
  client.login(DISCORD_TOKEN).catch(err => {
    console.warn('[Discord Gateway] Could not login with provided DISCORD_TOKEN:', err.message);
  });
} else {
  console.log('ℹ️ [Discord Gateway] No DISCORD_TOKEN in .env. Web Control Center running in standalone local mode.');
}

export { client, app };

