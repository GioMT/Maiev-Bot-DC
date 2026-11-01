import {
  initScheduledAlerts,
  getAlertsConfig,
  saveAlertsConfig,
  dispatchAlertMessage,
  DEFAULT_PRESET_ALERTS
} from './alerts.scheduler.js';

export const alertsFeature = {
  id: 'scheduled-alerts',
  name: 'Scheduled Notification & Custom Alerts',

  registerEvents({ client }) {
    client.once('ready', () => {
      initScheduledAlerts(client);
    });
  },

  registerRoutes(app, { client }) {
    // GET /api/alerts - Get all configured preset & custom alerts
    app.get('/api/alerts', (req, res) => {
      try {
        const data = getAlertsConfig();
        res.json({
          success: true,
          defaultPresets: DEFAULT_PRESET_ALERTS,
          ...data
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // POST /api/alerts/config - Save all alerts configuration
    app.post('/api/alerts/config', (req, res) => {
      try {
        const { alerts } = req.body;
        if (!Array.isArray(alerts)) {
          return res.status(400).json({ error: 'alerts array is required.' });
        }
        const saved = saveAlertsConfig(alerts);
        res.json({
          success: true,
          ...saved
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // POST /api/alerts/send - Immediately dispatch a specific alert (or custom alert payload) to its channel
    app.post('/api/alerts/send', async (req, res) => {
      try {
        const { alert, alerts } = req.body;
        if (Array.isArray(alerts)) {
          saveAlertsConfig(alerts);
        }
        if (!alert) {
          return res.status(400).json({ error: 'Alert configuration object is required.' });
        }

        const result = await dispatchAlertMessage(client, alert, { isManualTest: true });
        res.json({
          success: true,
          ...result,
          ...getAlertsConfig()
        });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
  }
};

