import { afterEach, describe, expect, it } from 'vitest';
import type { PlaybackEvent } from 'shared';

import { buildApp } from '../src/app.js';

const sampleEvent: PlaybackEvent = {
  eventType: 'play_request',
  sessionId: 'session-1',
  mediaId: 'sample',
  playerType: 'native',
  deliveryType: 'mp4',
  currentTime: 0,
  fromTime: null,
  toTime: null,
  deltaSeconds: null,
  duration: 120,
  occurredAt: '2026-04-15T00:00:00.000Z',
  bufferedRanges: [],
  userAgent: 'vitest'
};

const openApps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe('events routes', () => {
  it('accepts, returns, and resets captured events', async () => {
    const app = await buildApp();
    openApps.push(app);

    const postResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        events: [sampleEvent]
      }
    });

    expect(postResponse.statusCode).toBe(202);
    expect(postResponse.json()).toEqual({ accepted: 1 });

    const getResponse = await app.inject({
      method: 'GET',
      url: '/api/events'
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toMatchObject({
      count: 1,
      events: [sampleEvent]
    });

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/api/events'
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ reset: true });
  });

  it('rejects invalid event payloads', async () => {
    const app = await buildApp();
    openApps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        events: [{ nope: true }]
      }
    });

    expect(response.statusCode).toBe(400);
  });
});
