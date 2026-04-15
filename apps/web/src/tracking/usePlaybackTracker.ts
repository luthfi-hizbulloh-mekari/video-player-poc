import type { BufferedRange, DeliveryType, PlaybackEvent, PlaybackEventType, PlayerType } from 'shared';

type TrackerContext = {
  sessionId: string;
  mediaId: string;
  playerType: PlayerType;
  deliveryType: DeliveryType;
  userAgent: string;
};

type TrackerStore = {
  addEvent: (event: PlaybackEvent) => void;
  setPostError: (message: string | null) => void;
};

type EventSeed = {
  eventType: PlaybackEventType;
  currentTime: number | null;
  duration: number | null;
  bufferedRanges?: BufferedRange[];
  fromTime?: number | null;
  toTime?: number | null;
  deltaSeconds?: number | null;
};

export function buildPlaybackEvent(context: TrackerContext, seed: EventSeed): PlaybackEvent {
  return {
    eventType: seed.eventType,
    sessionId: context.sessionId,
    mediaId: context.mediaId,
    playerType: context.playerType,
    deliveryType: context.deliveryType,
    currentTime: seed.currentTime,
    fromTime: seed.fromTime ?? null,
    toTime: seed.toTime ?? null,
    deltaSeconds: seed.deltaSeconds ?? null,
    duration: seed.duration,
    occurredAt: new Date().toISOString(),
    bufferedRanges: seed.bufferedRanges ?? [],
    userAgent: context.userAgent
  };
}

export function createPlayRequestEvent(
  context: TrackerContext,
  currentTime: number | null,
  duration: number | null,
  bufferedRanges: BufferedRange[]
) {
  return buildPlaybackEvent(context, {
    eventType: 'play_request',
    currentTime,
    duration,
    bufferedRanges
  });
}

export function createSkipEvent(
  context: TrackerContext,
  eventType: 'skip_forward' | 'skip_backward',
  fromTime: number,
  toTime: number,
  duration: number | null,
  bufferedRanges: BufferedRange[]
) {
  return buildPlaybackEvent(context, {
    eventType,
    currentTime: toTime,
    fromTime,
    toTime,
    deltaSeconds: toTime - fromTime,
    duration,
    bufferedRanges
  });
}

export function createSeekEvent(
  context: TrackerContext,
  eventType: 'seek_start' | 'seek_end',
  fromTime: number | null,
  toTime: number | null,
  duration: number | null,
  bufferedRanges: BufferedRange[]
) {
  return buildPlaybackEvent(context, {
    eventType,
    currentTime: toTime,
    fromTime,
    toTime,
    deltaSeconds:
      fromTime === null || toTime === null
        ? null
        : toTime - fromTime,
    duration,
    bufferedRanges
  });
}

export function usePlaybackTracker(
  store: TrackerStore,
  fetchImpl: typeof fetch = fetch
) {
  const queue: PlaybackEvent[] = [];
  let flushTimer: number | null = null;

  const flush = async () => {
    flushTimer = null;

    if (queue.length === 0) {
      return;
    }

    const batch = queue.splice(0, queue.length);

    try {
      const response = await fetchImpl('/api/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ events: batch })
      });

      if (!response.ok) {
        throw new Error(`Event ingestion failed: ${response.status}`);
      }

      store.setPostError(null);
    } catch (error) {
      queue.unshift(...batch);
      store.setPostError(error instanceof Error ? error.message : 'Event ingestion failed');
    }
  };

  const scheduleFlush = () => {
    if (flushTimer !== null) {
      return;
    }

    flushTimer = window.setTimeout(() => {
      void flush();
    }, 300);
  };

  const recordEvent = (event: PlaybackEvent) => {
    store.addEvent(event);
    queue.push(event);
    scheduleFlush();
  };

  return {
    recordEvent
  };
}
