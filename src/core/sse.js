import { eventBus } from './event-bus.js';
import { configStore } from './storage/config-store.js';

const sseClients = new Set();

export function setupSseStream(app) {
  // Broadcast config updates to all connected Web UI clients
  eventBus.on('config:updated', (config) => {
    const payload = JSON.stringify({
      type: 'config_updated',
      config,
      timestamp: Date.now()
    });
    for (const clientRes of sseClients) {
      try {
        clientRes.write(`data: ${payload}\n\n`);
      } catch (_) {
        sseClients.delete(clientRes);
      }
    }
  });

  // Keep-alive heartbeat every 25s
  setInterval(() => {
    for (const clientRes of sseClients) {
      try {
        clientRes.write(': keepalive\n\n');
      } catch (_) {
        sseClients.delete(clientRes);
      }
    }
  }, 25000);

  // SSE Endpoint
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const config = configStore.get();
    res.write(`data: ${JSON.stringify({ type: 'connected', config, timestamp: Date.now() })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });
}

