import Hls from 'hls.js';
import Plyr from 'plyr';
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

function toBufferedRangesFromFraction(fraction: number, duration: number | null): BufferedRange[] {
  if (duration === null || !Number.isFinite(fraction) || fraction <= 0) {
    return [];
  }

  return [
    {
      start: 0,
      end: Math.max(0, Math.min(fraction, 1) * duration)
    }
  ];
}

function extractYouTubeId(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('youtu.be')) {
      const shortId = parsed.pathname.replace(/^\/+/, '').split('/')[0];

      if (shortId) {
        return shortId;
      }
    }

    const queryId = parsed.searchParams.get('v');

    if (queryId) {
      return queryId;
    }

    if (parsed.pathname.startsWith('/embed/')) {
      const embedId = parsed.pathname.split('/').at(-1);

      if (embedId) {
        return embedId;
      }
    }
  } catch {
    // Fall back to regex parsing for malformed URLs.
  }

  return (
    url.match(/[?&]v=([^&]+)/)?.[1] ??
    url.match(/youtu\.be\/([^?&/]+)/)?.[1] ??
    url.match(/youtube\.com\/embed\/([^?&/]+)/)?.[1] ??
    null
  );
}

export function createPlyrPlayer({ container, onEvent }: PlayerAdapterOptions): PlayerAdapter {
  let hls: Hls | null = null;
  let player: Plyr | null = null;
  let currentVideo: HTMLVideoElement | null = null;
  let isBuffering = false;
  let suppressSeekPair = false;
  let pendingSeekFrom: number | null = null;
  let lastKnownTime = 0;
  let errorMessage: string | null = null;

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

    const currentTime = toFiniteNumber(player.currentTime);
    const duration = toFiniteNumber(player.duration);

    return {
      currentTime,
      duration,
      paused: player.paused,
      bufferedRanges: currentVideo
        ? toBufferedRanges(currentVideo.buffered)
        : toBufferedRangesFromFraction(player.buffered, duration),
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

  const destroyHls = () => {
    hls?.destroy();
    hls = null;
  };

  const destroyPlayer = () => {
    player?.destroy();
    player = null;
    currentVideo = null;
    container.replaceChildren();
  };

  const createHtml5Root = () => {
    const video = document.createElement('video');

    video.controls = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.className = 'player-panel__video player-panel__video--plyr';
    container.replaceChildren(video);

    currentVideo = video;

    return video;
  };

  const bindEvents = (instance: Plyr) => {
    instance.on('play', () => {
      lastKnownTime = toFiniteNumber(instance.currentTime) ?? lastKnownTime;
      emit({ type: 'play_request' });
    });

    instance.on('playing', () => {
      if (isBuffering) {
        emit({ type: 'buffer_end' });
        isBuffering = false;
      }

      lastKnownTime = toFiniteNumber(instance.currentTime) ?? lastKnownTime;
      emit({ type: 'playing' });
    });

    instance.on('pause', () => {
      lastKnownTime = toFiniteNumber(instance.currentTime) ?? lastKnownTime;

      if (!instance.ended) {
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

      const nextTime = toFiniteNumber(instance.currentTime) ?? lastKnownTime;
      const fromTime = pendingSeekFrom ?? lastKnownTime;

      emit({
        type: 'seek_start',
        fromTime,
        toTime: nextTime,
        deltaSeconds: nextTime - fromTime
      });
    });

    instance.on('seeked', () => {
      const nextTime = toFiniteNumber(instance.currentTime) ?? lastKnownTime;
      const fromTime = pendingSeekFrom ?? lastKnownTime;

      if (suppressSeekPair) {
        suppressSeekPair = false;
        pendingSeekFrom = null;
        lastKnownTime = nextTime;
        return;
      }

      emit({
        type: 'seek_end',
        fromTime,
        toTime: nextTime,
        deltaSeconds: nextTime - fromTime
      });
      pendingSeekFrom = null;
      lastKnownTime = nextTime;
    });

    instance.on('timeupdate', () => {
      lastKnownTime = toFiniteNumber(instance.currentTime) ?? lastKnownTime;
    });

    instance.on('ended', () => {
      emit({ type: 'ended' });
    });

    instance.on('error', () => {
      errorMessage = currentVideo ? 'Plyr player error' : 'Plyr YouTube embed error';
      emit({
        type: 'error',
        errorMessage
      });
    });
  };

  const createPlayer = (root: HTMLVideoElement | HTMLDivElement) => {
    const instance = new Plyr(root, {
      seekTime: 10
    });

    player = instance;
    bindEvents(instance);

    return instance;
  };

  const emitLoadError = (message: string) => {
    errorMessage = message;
    emit({
      type: 'error',
      errorMessage,
      bufferedRanges: [],
      currentTime: 0,
      duration: null
    });
  };

  return {
    async load(source) {
      destroyHls();
      destroyPlayer();
      errorMessage = null;
      isBuffering = false;
      pendingSeekFrom = null;
      suppressSeekPair = false;
      lastKnownTime = 0;

      if (!source.available) {
        emitLoadError('Selected media is not available yet. Generate fixtures first.');
        return;
      }

      if (source.deliveryType === 'youtube') {
        const videoId = extractYouTubeId(source.url);

        if (!videoId) {
          emitLoadError('Could not extract a YouTube video ID from this source.');
          return;
        }

        const root = document.createElement('div');
        root.setAttribute('data-plyr-provider', 'youtube');
        root.setAttribute('data-plyr-embed-id', videoId);
        container.replaceChildren(root);
        currentVideo = null;
        createPlayer(root);
        return;
      }

      const video = createHtml5Root();
      createPlayer(video);

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
          emitLoadError('This browser does not support HLS in the Plyr lane.');
          return;
        }
      } else {
        video.src = source.url;
      }

      video.load();
    },
    async play() {
      if (!player) {
        return;
      }

      await Promise.resolve(player.play());
    },
    pause() {
      player?.pause();
    },
    seekTo(nextTime: number, intent: SeekIntent) {
      if (!player) {
        return;
      }

      const duration = toFiniteNumber(player.duration) ?? nextTime;
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
      destroyHls();
      destroyPlayer();
    }
  };
}
