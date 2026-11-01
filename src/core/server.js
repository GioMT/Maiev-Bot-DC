import express from 'express';
import path from 'node:path';
import { ROOT_DIR } from './storage/config-store.js';

export function createWebServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(ROOT_DIR, 'public'), {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));
  return app;
}

