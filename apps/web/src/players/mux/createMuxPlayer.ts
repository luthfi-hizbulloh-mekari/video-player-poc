import '@mux/mux-player';
import type { BufferedRange } from 'shared';

import type {
  PlayerAdapter,
  PlayerAdapterEvent,
  PlayerAdapterOptions,
  PlayerSnapshot,
  PlayerSource,
  SeekIntent
} from '../types';

type MuxPlayerElement = HTMLElement & {
  buffered: TimeRanges;
  currentTime: number;
  duration: number;
  ended: boolean;
  error?: { message?: string | null } | null;
  paused: boolean;
  play: () => Promise<void>;
  pause: () => void;
  load?: () => void;
};

function toBufferedRanges(buffered: TimeRanges): BufferedRange[] {
  return Array.from({ length: buffered.length }, (_, index) => ({
    start: buffered.start(index),
    end: buffered.end(index)
  }));
}

function toFiniteNumber(value: number) {
  return Number.isFinite(value) ? value : null;
}

function getErrorMessage(player: MuxPlayerElement) {
  return player.error?.message ?? 'Mux player error';
}

export function createMuxPlayer({ container, onEvent }: PlayerAdapterOptions): PlayerAdapter {
  const player = document.createElement('mux-player') as MuxPlayerElement;
  const listeners = new AbortController();
  let isBuffering = false;
  let suppressSeekPair = false;
  let pendingSeekFrom: number | null = null;
  let lastKnownTime = 0;
  let errorMessage: string | null = null;

  player.className = 'player-panel__video';
  player.setAttribute('controls', '');
  player.setAttribute('crossorigin', 'anonymous');
  player.setAttribute('playsinline', '');
  player.setAttribute('stream-type', 'on-demand');
  container.replaceChildren(player);

  const snapshot = (): PlayerSnapshot => ({
    currentTime: toFiniteNumber(player.currentTime),
    duration: toFiniteNumber(player.duration),
    paused: player.paused,
    bufferedRanges: toBufferedRanges(player.buffered),
    errorMessage
  });

  const emit = (
    event: Omit<PlayerAdapterEvent, 'bufferedRanges' | 'currentTime' | 'duration'> &
      Partial<Pick<PlayerAdapterEvent, 'bufferedRanges' | 'currentTime' | 'duration'>>
  ) => {
    const nextSnapshot = snapshot();

    onEvent({
      ...event,
      bufferedRanges: event.bufferedRanges ?? nextSnapshot.bufferedRanges,
      currentTime: event.currentTime ?? nextSnapshot.currentTime,
      duration: event.duration ?? nextSnapshot.duration
    });
  };

  player.addEventListener(
    'play',
    () => {
      lastKnownTime = player.currentTime;
      emit({ type: 'play_request' });
    },
    { signal: listeners.signal }
  );

  player.addEventListener(
    'playing',
    () => {
      if (isBuffering) {
        emit({ type: 'buffer_end' });
        isBuffering = false;
      }

      lastKnownTime = player.currentTime;
      emit({ type: 'playing' });
    },
    { signal: listeners.signal }
  );

  player.addEventListener(
    'pause',
    () => {
      lastKnownTime = player.currentTime;

      if (!player.ended) {
        emit({ type: 'pause' });
      }
    },
    { signal: listeners.signal }
  );

  player.addEventListener(
    'waiting',
    () => {
      if (!isBuffering) {
        isBuffering = true;
        emit({ type: 'buffer_start' });
      }
    },
    { signal: listeners.signal }
  );

  player.addEventListener(
    'seeking',
    () => {
      if (suppressSeekPair) {
        return;
      }

      const fromTime = pendingSeekFrom ?? lastKnownTime;
      emit({
        type: 'seek_start',
        fromTime,
        toTime: player.currentTime,
        deltaSeconds: player.currentTime - fromTime
      });
    },
    { signal: listeners.signal }
  );

  player.addEventListener(
    'seeked',
    () => {
      const fromTime = pendingSeekFrom ?? lastKnownTime;

      if (suppressSeekPair) {
        suppressSeekPair = false;
        pendingSeekFrom = null;
        lastKnownTime = player.currentTime;
        return;
      }

      emit({
        type: 'seek_end',
        fromTime,
        toTime: player.currentTime,
        deltaSeconds: player.currentTime - fromTime
      });
      pendingSeekFrom = null;
      lastKnownTime = player.currentTime;
    },
    { signal: listeners.signal }
  );

  player.addEventListener(
    'timeupdate',
    () => {
      lastKnownTime = player.currentTime;
    },
    { signal: listeners.signal }
  );

  player.addEventListener(
    'ended',
    () => {
      emit({ type: 'ended' });
    },
    { signal: listeners.signal }
  );

  player.addEventListener(
    'error',
    () => {
      errorMessage = getErrorMessage(player);
      emit({
        type: 'error',
        errorMessage
      });
    },
    { signal: listeners.signal }
  );

  const resetPlayer = () => {
    player.pause();
    player.removeAttribute('playback-id');
    player.removeAttribute('src');
    player.load?.();
  };

  return {
    async load(source) {
      resetPlayer();
      errorMessage = null;
      isBuffering = false;
      pendingSeekFrom = null;
      suppressSeekPair = false;
      lastKnownTime = 0;

      if (!source.available) {
        errorMessage = 'Selected media is not available yet. Generate fixtures first.';
        emit({
          type: 'error',
          errorMessage,
          bufferedRanges: [],
          currentTime: 0,
          duration: null
        });
        return;
      }

      if (source.deliveryType !== 'mux') {
        errorMessage = 'The Mux lane only supports Mux delivery.';
        emit({
          type: 'error',
          errorMessage,
          bufferedRanges: [],
          currentTime: 0,
          duration: null
        });
        return;
      }

      player.setAttribute('playback-id', source.relativePath);
      player.load?.();
    },
    async play() {
      await player.play();
    },
    pause() {
      player.pause();
    },
    seekTo(nextTime: number, intent: SeekIntent) {
      const duration = Number.isFinite(player.duration) ? player.duration : nextTime;
      const clampedTarget = Math.max(0, Math.min(nextTime, duration));

      pendingSeekFrom = toFiniteNumber(player.currentTime) ?? lastKnownTime;

      if (intent !== 'seek') {
        suppressSeekPair = true;
      }

      player.currentTime = clampedTarget;
      lastKnownTime = clampedTarget;
    },
    getSnapshot() {
      return snapshot();
    },
    destroy() {
      listeners.abort();
      resetPlayer();
      container.replaceChildren();
    }
  };
}
