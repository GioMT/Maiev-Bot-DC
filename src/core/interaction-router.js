/**
 * Centralized Discord Interaction Router for Slash Commands, Buttons, and Modals.
 */
export class InteractionRouter {
  constructor() {
    this.commands = new Map();
    this.buttons = new Map();
    this.buttonPrefixes = [];
    this.modals = new Map();
  }

  registerCommand(name, handler) {
    this.commands.set(name, handler);
  }

  registerButton(customId, handler) {
    this.buttons.set(customId, handler);
  }

  registerButtonPrefix(prefix, handler) {
    this.buttonPrefixes.push({ prefix, handler });
  }

  registerModal(customId, handler) {
    this.modals.set(customId, handler);
  }

  mount(client, context) {
    client.on('interactionCreate', async (interaction) => {
      try {
        if (!interaction.guild || !interaction.member) return;

        // 1. Button Interactions
        if (interaction.isButton()) {
          const exactHandler = this.buttons.get(interaction.customId);
          if (exactHandler) {
            await exactHandler(interaction, context);
            return;
          }

          for (const { prefix, handler } of this.buttonPrefixes) {
            if (interaction.customId.startsWith(prefix)) {
              await handler(interaction, context);
              return;
            }
          }
          return;
        }

        // 2. Modal Submissions
        if (interaction.isModalSubmit()) {
          const modalHandler = this.modals.get(interaction.customId);
          if (modalHandler) {
            await modalHandler(interaction, context);
          }
          return;
        }

        // 3. Slash Commands
        if (interaction.isChatInputCommand()) {
          const cmdHandler = this.commands.get(interaction.commandName);
          if (cmdHandler) {
            await cmdHandler(interaction, context);
          }
          return;
        }
      } catch (err) {
        console.error('Unhandled interaction error:', err);
      }
    });
  }
}

