import { createApp } from './app.js';
import { config, llmEnabled } from './config.js';

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  const mode = llmEnabled() ? 'AI-assisted synthesis available' : 'keyless evidence engine';
  console.log(`[cairn] ${mode} · http://${config.host}:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
