import Hls from 'hls.js';
import type { BufferedRange } from 'shared';

import type {
  PlayerAdapter,
  PlayerAdapterEvent,
  PlayerAdapterOptions,
  PlayerSnapshot,
  PlayerSource,
  SeekIntent
} from '../types';

function toBufferedRanges(buffered: TimeRanges): BufferedRange[] {
  return Array.from({ length: buffered.length }, (_, index) => ({
    start: buffered.start(index),
    end: buffered.end(index)
  }));
}

function toFiniteNumber(value: number) {
  return Number.isFinite(value) ? value : null;
}

export function createNativePlayer({ container, onEvent }: PlayerAdapterOptions): PlayerAdapter {
  const video = document.createElement('video');
  const listeners = new AbortController();
  let hls: Hls | null = null;
  let isBuffering = false;
  let suppressSeekPair = false;
  let pendingSeekFrom: number | null = null;
  let lastKnownTime = 0;
  let errorMessage: string | null = null;

  video.controls = true;
  video.preload = 'metadata';
  video.crossOrigin = 'anonymous';
  video.playsInline = true;
  video.className = 'player-panel__video';
  container.replaceChildren(video);

  const snapshot = (): PlayerSnapshot => ({
    currentTime: toFiniteNumber(video.currentTime),
    duration: toFiniteNumber(video.duration),
    paused: video.paused,
    bufferedRanges: toBufferedRanges(video.buffered),
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

  const destroyHls = () => {
    hls?.destroy();
    hls = null;
  };

  video.addEventListener(
    'play',
    () => {
      lastKnownTime = video.currentTime;
      emit({ type: 'play_request' });
    },
    { signal: listeners.signal }
  );

  video.addEventListener(
    'playing',
    () => {
      if (isBuffering) {
        emit({ type: 'buffer_end' });
        isBuffering = false;
      }

      lastKnownTime = video.currentTime;
      emit({ type: 'playing' });
    },
    { signal: listeners.signal }
  );

  video.addEventListener(
    'pause',
    () => {
      lastKnownTime = video.currentTime;

      if (!video.ended) {
        emit({ type: 'pause' });
      }
    },
    { signal: listeners.signal }
  );

  video.addEventListener(
    'waiting',
    () => {
      if (!isBuffering) {
        isBuffering = true;
        emit({ type: 'buffer_start' });
      }
    },
    { signal: listeners.signal }
  );

  video.addEventListener(
    'seeking',
    () => {
      if (suppressSeekPair) {
        return;
      }

      const fromTime = pendingSeekFrom ?? lastKnownTime;
      emit({
        type: 'seek_start',
        fromTime,
        toTime: video.currentTime,
        deltaSeconds: video.currentTime - fromTime
      });
    },
    { signal: listeners.signal }
  );

  video.addEventListener(
    'seeked',
    () => {
      const fromTime = pendingSeekFrom ?? lastKnownTime;

      if (suppressSeekPair) {
        suppressSeekPair = false;
        pendingSeekFrom = null;
        lastKnownTime = video.currentTime;
        return;
      }

      emit({
        type: 'seek_end',
        fromTime,
        toTime: video.currentTime,
        deltaSeconds: video.currentTime - fromTime
      });
      pendingSeekFrom = null;
      lastKnownTime = video.currentTime;
    },
    { signal: listeners.signal }
  );

  video.addEventListener(
    'timeupdate',
    () => {
      lastKnownTime = video.currentTime;
    },
    { signal: listeners.signal }
  );

  video.addEventListener(
    'ended',
    () => {
      emit({ type: 'ended' });
    },
    { signal: listeners.signal }
  );

  video.addEventListener(
    'error',
    () => {
      errorMessage = video.error?.message ?? 'Native player error';
      emit({
        type: 'error',
        errorMessage
      });
    },
    { signal: listeners.signal }
  );

  const load = async (source: PlayerSource) => {
    destroyHls();
    video.pause();
    video.removeAttribute('src');
    video.load();
    errorMessage = null;
    isBuffering = false;
    pendingSeekFrom = null;
    suppressSeekPair = false;

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

    if (source.deliveryType === 'youtube') {
      errorMessage = 'This lane does not support YouTube sources. Switch to the Plyr lane.';
      emit({
        type: 'error',
        errorMessage,
        bufferedRanges: [],
        currentTime: 0,
        duration: null
      });
      return;
    }

    if (source.deliveryType === 'hls') {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = source.url;
      } else if (Hls.isSupported()) {
        hls = new Hls();
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            errorMessage = data.details || 'hls.js fatal error';
            emit({
              type: 'error',
              errorMessage
            });
          }
        });
        hls.loadSource(source.url);
        hls.attachMedia(video);
      } else {
        errorMessage = 'This browser does not support HLS in the native lane.';
        emit({
          type: 'error',
          errorMessage,
          bufferedRanges: [],
          currentTime: 0,
          duration: null
        });
        return;
      }
    } else {
      video.src = source.url;
    }

    video.load();
  };

  return {
    async load(source) {
      await load(source);
    },
    async play() {
      await video.play();
    },
    pause() {
      video.pause();
    },
    seekTo(nextTime: number, intent: SeekIntent) {
      const duration = Number.isFinite(video.duration) ? video.duration : nextTime;
      const clampedTarget = Math.max(0, Math.min(nextTime, duration));

      pendingSeekFrom = toFiniteNumber(video.currentTime) ?? lastKnownTime;

      if (intent !== 'seek') {
        suppressSeekPair = true;
      }

      video.currentTime = clampedTarget;
      lastKnownTime = clampedTarget;
    },
    getSnapshot() {
      return snapshot();
    },
    destroy() {
      listeners.abort();
      destroyHls();
      video.pause();
      container.replaceChildren();
    }
  };
}
