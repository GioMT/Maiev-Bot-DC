import { EventEmitter } from 'node:events';

class AppEventBus extends EventEmitter {}

export const eventBus = new AppEventBus();
eventBus.setMaxListeners(50);

