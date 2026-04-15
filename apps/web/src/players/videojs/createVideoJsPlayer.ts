import type { BufferedRange } from 'shared';
import videojs from 'video.js';

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

function toFiniteNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getCurrentTime(player: ReturnType<typeof videojs>) {
  return player.currentTime() ?? 0;
}

function getDuration(player: ReturnType<typeof videojs>) {
  return player.duration() ?? null;
}

function sourceMimeType(source: PlayerSource) {
  return source.deliveryType === 'hls' ? 'application/x-mpegURL' : 'video/mp4';
}

export function createVideoJsPlayer({ container, onEvent }: PlayerAdapterOptions): PlayerAdapter {
  const videoElement = document.createElement('video');
  type VideoJsPlayer = ReturnType<typeof videojs>;
  let player: VideoJsPlayer | null = null;
  let isBuffering = false;
  let suppressSeekPair = false;
  let pendingSeekFrom: number | null = null;
  let lastKnownTime = 0;
  let errorMessage: string | null = null;

  videoElement.className = 'video-js vjs-default-skin vjs-big-play-centered';
  videoElement.setAttribute('playsinline', 'true');
  videoElement.setAttribute('crossorigin', 'anonymous');
  container.replaceChildren(videoElement);

  const getPlayer = () => {
    if (!player) {
      throw new Error('Video.js player has not been initialized.');
    }

    return player;
  };

  const snapshot = (): PlayerSnapshot => {
    if (!player) {
      return {
        currentTime: 0,
        duration: null,
        paused: true,
        bufferedRanges: [],
        errorMessage
      };
    }

    return {
      currentTime: toFiniteNumber(getCurrentTime(player)),
      duration: toFiniteNumber(getDuration(player)),
      paused: player.paused(),
      bufferedRanges: toBufferedRanges(player.buffered()),
      errorMessage
    };
  };

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

  const bindEvents = (instance: VideoJsPlayer) => {
    instance.on('play', () => {
      lastKnownTime = getCurrentTime(instance);
      emit({ type: 'play_request' });
    });

    instance.on('playing', () => {
      if (isBuffering) {
        emit({ type: 'buffer_end' });
        isBuffering = false;
      }

      lastKnownTime = getCurrentTime(instance);
      emit({ type: 'playing' });
    });

    instance.on('pause', () => {
      if (!instance.ended()) {
        emit({ type: 'pause' });
      }
    });

    instance.on('waiting', () => {
      if (!isBuffering) {
        isBuffering = true;
        emit({ type: 'buffer_start' });
      }
    });

    instance.on('seeking', () => {
      if (suppressSeekPair) {
        return;
      }

      const fromTime = pendingSeekFrom ?? lastKnownTime;
      const currentTime = getCurrentTime(instance);
      emit({
        type: 'seek_start',
        fromTime,
        toTime: currentTime,
        deltaSeconds: currentTime - fromTime
      });
    });

    instance.on('seeked', () => {
      const fromTime = pendingSeekFrom ?? lastKnownTime;

      if (suppressSeekPair) {
        suppressSeekPair = false;
        pendingSeekFrom = null;
        lastKnownTime = getCurrentTime(instance);
        return;
      }

      const currentTime = getCurrentTime(instance);
      emit({
        type: 'seek_end',
        fromTime,
        toTime: currentTime,
        deltaSeconds: currentTime - fromTime
      });
      pendingSeekFrom = null;
      lastKnownTime = currentTime;
    });

    instance.on('timeupdate', () => {
      lastKnownTime = getCurrentTime(instance);
    });

    instance.on('ended', () => {
      emit({ type: 'ended' });
    });

    instance.on('error', () => {
      errorMessage = instance.error()?.message ?? 'Video.js player error';
      emit({
        type: 'error',
        errorMessage
      });
    });
  };

  player = videojs(videoElement, {
    controls: true,
    fluid: true,
    preload: 'metadata'
  });
  bindEvents(player);

  return {
    async load(source) {
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

      const instance = getPlayer();
      instance.pause();
      instance.src({
        src: source.url,
        type: sourceMimeType(source)
      });
      instance.load();
    },
    async play() {
      await getPlayer().play();
    },
    pause() {
      getPlayer().pause();
    },
    seekTo(nextTime: number, intent: SeekIntent) {
      const instance = getPlayer();
      const duration = toFiniteNumber(getDuration(instance)) ?? nextTime;
      const clampedTarget = Math.max(0, Math.min(nextTime, duration));

      pendingSeekFrom = toFiniteNumber(getCurrentTime(instance)) ?? lastKnownTime;

      if (intent !== 'seek') {
        suppressSeekPair = true;
      }

      instance.currentTime(clampedTarget);
      lastKnownTime = clampedTarget;
    },
    getSnapshot() {
      return snapshot();
    },
    destroy() {
      player?.dispose();
      player = null;
      container.replaceChildren();
    }
  };
}
