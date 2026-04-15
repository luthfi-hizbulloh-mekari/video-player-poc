import Fastify from 'fastify';

import { EventStore } from './domain/eventStore.js';
import { staticMediaPlugin } from './plugins/staticMedia.js';
import { registerEventRoutes } from './routes/events.js';
import { registerHealthRoute } from './routes/health.js';
import { registerMediaManifestRoute } from './routes/mediaManifest.js';

type BuildAppOptions = {
  store?: EventStore;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: false
  });

  const store = options.store ?? new EventStore();

  await app.register(staticMediaPlugin);
  await registerHealthRoute(app);
  await registerMediaManifestRoute(app);
  await registerEventRoutes(app, store);

  return app;
}
