import express from 'express';

import WALStore, { ApplyUpdateFn } from '../storage/wal-store';

const PORT = Number(process.env.LISTENER_PORT || 3000);
const HOST = process.env.LISTENER_HOST || '0.0.0.0'; // bind to all interfaces for LAN access

async function main() {
  const app = express();
  app.use(express.json());

  const store = new WALStore({ dir: './data' });
  await store.init();

  // SSE clients
  const sseClients: Array<express.Response> = [];

  // Helper to send SSE event to all clients
  function broadcastEvent(event: string, payload: any) {
    const data = `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(data);
      } catch (e) {
        // ignore errors; stale connections will be removed elsewhere
      }
    }
  }

  // Expose endpoints
  // List keys
  app.get('/keys', (_req, res) => {
    res.json(Object.keys(store.getAll()));
  });

  // Get a specific key
  app.get('/key/:key', (req, res) => {
    const k = req.params.key;
    res.json({ key: k, value: store.get(k) });
  });

  // Get full snapshot
  app.get('/snapshot', (_req, res) => {
    res.json(store.getAll());
  });

  // Apply an update (POST { key, value })
  app.post('/apply', async (req, res) => {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ error: 'missing key' });
    try {
      await store.applyUpdate({ key, value });
      // broadcast to SSE clients
      broadcastEvent('update', { key, value });
      return res.json({ ok: true });
    } catch (err) {
      console.error('applyUpdate error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // Server-Sent Events endpoint for real-time updates
  app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // send a comment to keep connection alive
    res.write(':ok\n\n');

    sseClients.push(res);

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx >= 0) sseClients.splice(idx, 1);
    });
  });

  // simple health
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const server = app.listen(PORT, HOST, () => {
    console.log(`Listener HTTP server running on http://${HOST}:${PORT}/`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down listener...');
    server.close();
    await store.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Listener failed to start', err);
  process.exit(1);
});
