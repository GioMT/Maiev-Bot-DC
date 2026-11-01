# Maiev Bot & Control Center — Architecture Refactoring Plan

This document outlines the recommended non-monolithic architecture for **Maiev Bot**, comparing various architectural patterns and providing a concrete, step-by-step roadmap to migrate from the current monolithic structure to a **Microkernel (Plugin-Based / Event-Driven) Architecture**.

---

## 1. Architectural Analysis & Comparison

| Architecture Pattern | Fit for Maiev Bot | Pros | Cons | Verdict |
| :--- | :---: | :--- | :--- | :--- |
| **Current Monolithic** | ⚠️ High Technical Debt | Quick to hack in one file initially (`index.js`, `app.js`). | `index.js` (~2.3k lines) and `app.js` (~2.2k lines) suffer from high coupling, risk of regression, and hard-to-maintain event handling. | ❌ Migrate away |
| **Strict Layered (Horizontal)** | ⚠️ Mediocre Fit | Standard pattern (`routes/`, `controllers/`, `services/`, `models/`). | Changing one feature (e.g. Reaction Roles) forces you to touch 6+ distant directories. Awkward for Discord events. | ❌ Not recommended |
| **Component-Based (Vertical Slices)** | ✅ Good Fit | Groups code by feature (`features/verification`, `features/reaction-roles`). | Better, but lacks dynamic lifecycle loading and standardized plugin isolation. | ⚠️ Decent alternative |
| **Microkernel / Plugin Architecture** | 🏆 **Best Fit** | Lightweight kernel + self-contained plugins. Perfect for event-driven Discord bots and modular web dashboards. | Requires a simple plugin-loader in the core. | **RECOMMENDED** |

---

## 2. Why Microkernel (Plugin-Based) is the Ideal Choice

A Discord bot is fundamentally an **event consumer** (`interactionCreate`, `messageReactionAdd`, `guildMemberAdd`), while its companion dashboard is a **configuration and triggering interface** for those exact events.

### Core Advantages:
1. **Zero Coupling Between Features**: A bug or crash in Reaction Roles cannot break IGN Verification or Rules Onboarding.
2. **Eliminates Massive `if/else` Event Trees**: Instead of one monolithic `client.on('interactionCreate')` checking every single `customId`, each plugin registers its own handlers.
3. **Feature Toggles**: Any plugin can be enabled or disabled via configuration or reloaded without restarting the entire bot.
4. **Effortless Future Expansion**: Want to add a *Legion Raid Scheduler*, *Aion 2 Gear Calculator*, or *Guild Bank Log*? Drop a new folder into `src/plugins/` without modifying core bot code.

---

## 3. Target Directory Structure

```text
Maiev-Bot-DC/
├── src/
│   ├── index.js                     # Application entry point (boots Kernel)
│   │
│   ├── kernel/                      # The Microkernel (Core Engine)
│   │   ├── discord-client.js        # Discord.js client lifecycle & gateway connection
│   │   ├── web-server.js            # Express server initialization & middleware
│   │   ├── plugin-loader.js         # Discovers, validates, and mounts plugins
│   │   ├── event-bus.js             # Internal event emitter for inter-plugin events
│   │   └── config-store.js          # Thread-safe config loader/saver (config.json)
│   │
│   ├── shared/                      # Reusable utilities across plugins
│   │   ├── discord-embeds.js        # Standard embed formatting & colors
│   │   ├── markdown-utils.js        # Discord markdown converters
│   │   └── logger.js                # Structured logging with timestamps
│   │
│   └── plugins/                     # Self-Contained Domain Plugins
│       ├── rules/
│       │   ├── index.js             # Plugin manifest & registration
│       │   ├── rules.bot.js         # Button interaction & compliant role assignment
│       │   ├── rules.api.js         # /api/post-rules endpoint
│       │   └── rules.embed.js       # Rules card embed builder
│       │
│       ├── verification/
│       │   ├── index.js             # Plugin manifest
│       │   ├── verify.bot.js        # IGN modal submit & nickname update
│       │   ├── verify.api.js        # /api/verify endpoints
│       │   └── verify.embed.js      # Verification instructions & welcome card
│       │
│       ├── reaction-roles/
│       │   ├── index.js             # Plugin manifest
│       │   ├── reaction.bot.js      # Emoji add/remove listeners & role toggle logic
│       │   ├── reaction.api.js      # Reaction preset CRUD endpoints
│       │   └── presets.config.js    # Default preset definitions (Classes, Region, Alerts)
│       │
│       ├── boss-timer/
│       │   ├── index.js             # Plugin manifest
│       │   ├── boss-tracker.js      # Field boss timer logic & API fetcher
│       │   └── boss-timer.bot.js    # Boss alert embeds & slash commands
│       │
│       └── welcome-announcements/
│           ├── index.js             # Plugin manifest
│           ├── announcement.bot.js  # Public welcome channel poster
│           └── announcement.api.js  # Manual test announcement trigger
│
├── public/                          # Modernized Modular Frontend (Vanilla ES Modules)
│   ├── index.html                   # Clean dashboard layout shell
│   ├── css/
│   │   ├── style.css                # Base design tokens, resets, layouts
│   │   └── components/              # Modular component stylesheets
│   │       ├── telemetry.css
│   │       ├── subtabs.css
│   │       └── simulator.css
│   │
│   └── js/
│       ├── app.js                   # Application bootstrap & tab navigation orchestrator
│       ├── api-client.js            # Fetch wrapper with error handling & toast dispatch
│       └── components/              # Reusable UI component modules
│           ├── header-telemetry.js  # Server name editable input, ping, status
│           ├── rules-editor.js      # Stage 1 Rules form & live simulator
│           ├── verify-editor.js     # Stage 2 IGN form & modal preview
│           ├── reaction-roles.js    # Stage 4 Preset subtabs & card actions
│           └── diagnostics.js       # Stage 5 Discord permissions table
│
├── config.json                      # Persistent configuration storage
├── package.json
└── README.md
```

---

## 4. Plugin Specification & Contract

Each plugin in `src/plugins/<name>/index.js` exports a standard contract that the kernel recognizes:

```javascript
// Example: src/plugins/verification/index.js
export default {
  id: 'verification',
  name: 'AION 2 IGN Verification',
  version: '1.0.0',
  description: 'Handles IGN registration, nickname changes, and verification roles',

  /**
   * Register Discord Gateway Event Handlers
   * @param {import('discord.js').Client} client
   * @param {EventEmitter} eventBus
   * @param {Object} context
   */
  registerBot(client, eventBus, context) {
    // Isolated button & modal listeners
    client.on('interactionCreate', async (interaction) => {
      if (interaction.isButton() && interaction.customId === 'open_ign_modal') {
        // Handle modal presentation
      }
      if (interaction.isModalSubmit() && interaction.customId === 'ign_verification_modal') {
        // Handle IGN nickname updates & role assignment
      }
    });
  },

  /**
   * Register Express REST API Endpoints
   * @param {import('express').Router} router
   * @param {Object} context
   */
  registerRoutes(router, context) {
    router.post('/api/verify/post-card', async (req, res) => {
      // Post verification card to Discord channel
    });
  },

  /**
   * Optional lifecycle teardown (invoked if plugin is reloaded or disabled)
   */
  onDisable() {
    // Clean up active timers or event listeners
  }
};
```

---

## 5. The Microkernel Implementation (How the Loader Works)

The Kernel's plugin loader is lightweight (~50 lines of code) and dynamically loads all plugins on startup:

```javascript
// src/kernel/plugin-loader.js
import fs from 'fs';
import path from 'path';

export async function loadPlugins({ client, app, eventBus, configStore }) {
  const pluginsDir = path.join(process.cwd(), 'src', 'plugins');
  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });

  const loadedPlugins = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const pluginPath = path.join(pluginsDir, entry.name, 'index.js');
      if (fs.existsSync(pluginPath)) {
        try {
          const { default: plugin } = await import(`file://${pluginPath}`);

          // 1. Mount Discord Event Handlers
          if (typeof plugin.registerBot === 'function') {
            plugin.registerBot(client, eventBus, { configStore });
          }

          // 2. Mount REST API Routes
          if (typeof plugin.registerRoutes === 'function') {
            plugin.registerRoutes(app, { client, configStore, eventBus });
          }

          loadedPlugins.push(plugin.id || entry.name);
          console.log(`🔌 [Plugin Loaded] ${plugin.name} v${plugin.version}`);
        } catch (err) {
          console.error(`❌ [Plugin Error] Failed to load "${entry.name}":`, err);
        }
      }
    }
  }

  return loadedPlugins;
}
```

---

## 6. Frontend Modernization (Vanilla ES Modules)

You do **not** need to install heavy frameworks (React/Vue/Webpack) if you prefer keeping zero build steps. Modern browsers natively support **Vanilla ES Modules**:

In `public/index.html`:
```html
<script type="module" src="js/app.js"></script>
```

In `public/js/app.js`:
```javascript
import { initTelemetry } from './components/header-telemetry.js';
import { initRulesEditor } from './components/rules-editor.js';
import { initVerifyEditor } from './components/verify-editor.js';
import { initReactionRoles } from './components/reaction-roles.js';
import { fetchServerState } from './api-client.js';

async function bootstrap() {
  const state = await fetchServerState();
  initTelemetry(state);
  initRulesEditor(state);
  initVerifyEditor(state);
  initReactionRoles(state);
}

document.addEventListener('DOMContentLoaded', bootstrap);
```

---

## 7. Step-by-Step Refactoring Roadmap

To ensure **zero downtime and no broken features**, refactor incrementally:

### Phase 1: Core Kernel Extraction
1. Create `src/kernel/config-store.js` and move `config.json` reading/saving logic into it.
2. Create `src/kernel/discord-client.js` and move the `new Client(...)` initialization and ready event.
3. Create `src/kernel/web-server.js` and move the Express setup and static middleware.

### Phase 2: Feature Plugin Migration (One by One)
1. **Boss Timer Plugin**: Move `bossTimer.js` logic into `src/plugins/boss-timer/`.
2. **Rules Plugin**: Extract rules slash commands, button handler, and `/api/post-rules` into `src/plugins/rules/`.
3. **Verification Plugin**: Extract IGN setup modal handler, nickname update logic, and `/api/post-verify` into `src/plugins/verification/`.
4. **Reaction Roles Plugin**: Extract reaction tracking, emoji add/remove listeners, and preset management into `src/plugins/reaction-roles/`.

### Phase 3: Frontend Modularization
1. Split `public/app.js` into focused ES modules under `public/js/components/`.
2. Keep `index.html` structure clean, with each tab populated by its dedicated component script.

---

## 8. Summary Checklist When You Begin

- [ ] Ensure full test/preview run with `npm start` before modifying files.
- [ ] Implement `src/kernel/plugin-loader.js` first.
- [ ] Migrate one feature at a time and verify via Web Control Center at `http://localhost:3000/`.
- [ ] Maintain the shared `config.json` format to ensure backwards compatibility with saved settings.
