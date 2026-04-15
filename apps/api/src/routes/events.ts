import type { FastifyInstance } from 'fastify';
import { playbackEventBatchSchema } from 'shared';

import type { EventStore } from '../domain/eventStore.js';

export async function registerEventRoutes(app: FastifyInstance, store: EventStore) {
  app.get('/api/events', async () => ({
    count: store.list().length,
    events: store.list()
  }));

  app.post('/api/events', async (request, reply) => {
    const parsed = playbackEventBatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Invalid playback event payload',
        issues: parsed.error.issues
      });
    }

    store.addMany(parsed.data.events);

    return reply.status(202).send({
      accepted: parsed.data.events.length
    });
  });

  app.delete('/api/events', async () => {
    store.clear();

    return {
      reset: true
    };
  });
}
