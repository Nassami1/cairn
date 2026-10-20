import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import verifyRouter from './routes/verify.js';
import { config } from './config.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    res.setHeader('x-frame-options', 'SAMEORIGIN');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(express.json({ limit: '16kb' }));

  app.use('/api/verify', verifyRouter);

  app.get('/api', (_req, res) => {
    res.json({ name: 'Cairn', version: '0.1.0', docs: 'https://github.com/' });
  });

  const dist = path.join(config.root, 'dist');
  const indexFile = path.join(dist, 'index.html');
  const hasBuild = fs.existsSync(indexFile);

  if (hasBuild) {
    app.use(
      express.static(dist, {
        index: false,
        dotfiles: 'allow',
        maxAge: '1h',
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('cache-control', 'public, max-age=31536000, immutable');
          } else if (filePath.endsWith('index.html')) {
            res.setHeader('cache-control', 'no-cache');
          }
        },
      })
    );
  }

  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (!hasBuild) {
      return res
        .status(503)
        .type('text/plain')
        .send('Cairn is not built yet. Run `npm run build` (or `npm run dev` for the Vite server).');
    }
    res.setHeader('cache-control', 'no-cache');
    return res.sendFile(indexFile, { dotfiles: 'allow' });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'not_found' });
  });

  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Body must be valid JSON.', code: 'bad_json' });
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'That request is too large.', code: 'too_large' });
    }
    console.error('[cairn] unhandled', error);
    return res.status(500).json({ error: 'Unexpected server error.', code: 'server_error' });
  });

  return app;
}
