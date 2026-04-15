import type { FastifyInstance } from 'fastify';

import { getMediaFixtures } from '../domain/mediaFixtures.js';

export async function registerMediaManifestRoute(app: FastifyInstance) {
  app.get('/api/media/manifest', async () => ({
    fixtures: getMediaFixtures(),
    generatedAt: new Date().toISOString()
  }));
}
