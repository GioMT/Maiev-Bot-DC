/**
 * Mounts all feature plugins onto the Discord client, InteractionRouter, CommandRegistry, and Express server.
 */
export function loadFeatures(features, context) {
  const { client, app, router, commandRegistry } = context;

  for (const feature of features) {
    // 1. Register Slash Command Builders
    if (Array.isArray(feature.commands)) {
      commandRegistry.addCommands(feature.commands);
    }

    // 2. Register Command Execution Handlers
    if (feature.commandHandlers) {
      for (const [cmdName, handler] of Object.entries(feature.commandHandlers)) {
        router.registerCommand(cmdName, handler);
      }
    }

    // 3. Register Exact Button Handlers
    if (feature.buttons) {
      for (const [customId, handler] of Object.entries(feature.buttons)) {
        router.registerButton(customId, handler);
      }
    }

    // 4. Register Prefix Button Handlers (e.g. 'btn_nat_')
    if (feature.buttonPrefixes) {
      for (const [prefix, handler] of Object.entries(feature.buttonPrefixes)) {
        router.registerButtonPrefix(prefix, handler);
      }
    }

    // 5. Register Modal Submit Handlers
    if (feature.modals) {
      for (const [customId, handler] of Object.entries(feature.modals)) {
        router.registerModal(customId, handler);
      }
    }

    // 5b. Register Prefix Modal Submit Handlers (e.g. 'modal_vthread_')
    if (feature.modalPrefixes) {
      for (const [prefix, handler] of Object.entries(feature.modalPrefixes)) {
        router.registerModalPrefix(prefix, handler);
      }
    }

    // 6. Register Discord Gateway / Internal Event Listeners
    if (typeof feature.registerEvents === 'function') {
      feature.registerEvents(context);
    }

    // 7. Register Express REST API Endpoints
    if (typeof feature.registerRoutes === 'function') {
      feature.registerRoutes(app, context);
    }

    console.log(`🔌 [Feature Mounted] ${feature.name || feature.id}`);
  }

  // Mount the centralized interaction router on the Discord client
  router.mount(client, context);
}

