import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/api.ts';
import { getDatabase } from './server/db.ts';
import { startExpiryScheduledJob, autoExpireMiddleware } from './server/expiryEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Initialize Database & Seeds
  await getDatabase();
  console.log('Database initialized successfully with SQLite persistence');

  // Start Scheduled Pass Expiry Job (Every 30 seconds)
  startExpiryScheduledJob(30000);

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // JSON Body Parser with 10MB limit for base64 visitor photo uploads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Auto-expire passes middleware (ensures passes are transitioned before processing requests)
  app.use(autoExpireMiddleware);

  // API Routes
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FactoryPass server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
