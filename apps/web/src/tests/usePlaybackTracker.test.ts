import { describe, expect, it } from 'vitest';

import { createSeekEvent, createSkipEvent } from '../tracking/usePlaybackTracker';

const context = {
  sessionId: 'session-1',
  mediaId: 'sample',
  playerType: 'native' as const,
  deliveryType: 'mp4' as const,
  userAgent: 'vitest'
};

describe('usePlaybackTracker helpers', () => {
  it('creates explicit skip events with delta metadata', () => {
    const event = createSkipEvent(context, 'skip_forward', 10, 20, 120, []);

    expect(event.eventType).toBe('skip_forward');
    expect(event.fromTime).toBe(10);
    expect(event.toTime).toBe(20);
    expect(event.deltaSeconds).toBe(10);
  });

  it('creates seek events for unlocked scrubbing interactions', () => {
    const event = createSeekEvent(context, 'seek_end', 8, 34, 120, []);

    expect(event.eventType).toBe('seek_end');
    expect(event.fromTime).toBe(8);
    expect(event.toTime).toBe(34);
    expect(event.deltaSeconds).toBe(26);
  });
});
