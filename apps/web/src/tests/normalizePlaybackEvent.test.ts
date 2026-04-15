import { describe, expect, it, vi } from 'vitest';

import { normalizePlaybackEvent } from '../tracking/normalizePlaybackEvent';

describe('normalizePlaybackEvent', () => {
  it('maps native playback events into the shared schema', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));

    const event = normalizePlaybackEvent({
      adapterEvent: {
        type: 'playing',
        currentTime: 1.25,
        duration: 120,
        bufferedRanges: [{ start: 0, end: 6.5 }]
      },
      sessionId: 'session-1',
      mediaId: 'sample',
      playerType: 'native',
      deliveryType: 'mp4',
      userAgent: 'vitest'
    });

    expect(event).toEqual({
      eventType: 'playing',
      sessionId: 'session-1',
      mediaId: 'sample',
      playerType: 'native',
      deliveryType: 'mp4',
      currentTime: 1.25,
      fromTime: null,
      toTime: null,
      deltaSeconds: null,
      duration: 120,
      occurredAt: '2026-04-15T12:00:00.000Z',
      bufferedRanges: [{ start: 0, end: 6.5 }],
      userAgent: 'vitest'
    });
  });

  it('preserves seek metadata from library adapters', () => {
    const event = normalizePlaybackEvent({
      adapterEvent: {
        type: 'seek_end',
        currentTime: 42,
        duration: 120,
        fromTime: 12,
        toTime: 42,
        deltaSeconds: 30,
        bufferedRanges: []
      },
      sessionId: 'session-2',
      mediaId: 'sample',
      playerType: 'videojs',
      deliveryType: 'hls',
      userAgent: 'vitest'
    });

    expect(event.eventType).toBe('seek_end');
    expect(event.deltaSeconds).toBe(30);
    expect(event.playerType).toBe('videojs');
    expect(event.deliveryType).toBe('hls');
  });
});
