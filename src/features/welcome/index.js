import { eventBus } from '../../core/event-bus.js';
import {
  sendPublicWelcomeAnnouncement,
  handleTestWelcomeApi
} from './welcome.service.js';

export const welcomeFeature = {
  id: 'welcome',
  name: 'Public Welcome Announcements',

  registerEvents() {
    eventBus.on('member:verified', (payload) => {
      sendPublicWelcomeAnnouncement(payload);
    });
  },

  registerRoutes(app, context) {
    app.post('/api/test-welcome', (req, res) => handleTestWelcomeApi(req, res, context));
  }
};

