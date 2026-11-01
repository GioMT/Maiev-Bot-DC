import { REST, Routes } from 'discord.js';

export class CommandRegistry {
  constructor() {
    this.builders = [];
  }

  addCommands(commands = []) {
    for (const cmd of commands) {
      if (cmd) this.builders.push(cmd);
    }
  }

  async registerAll({ token, clientId, guildId }) {
    if (!token || !clientId || this.builders.length === 0) return;
    const rest = new REST({ version: '10' }).setToken(token);
    try {
      const commandsJson = this.builders.map(cmd => (typeof cmd.toJSON === 'function' ? cmd.toJSON() : cmd));
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandsJson });
        console.log(`✅ Guild slash commands registered for Guild ID: ${guildId}`);
      }
      await rest.put(Routes.applicationCommands(clientId), { body: commandsJson });
      console.log(`✅ Global slash commands registered successfully! (${commandsJson.length} commands)`);
    } catch (error) {
      console.error('⚠️ Warning: Failed to register slash commands:', error.message);
    }
  }
}

