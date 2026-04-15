<template>
  <section class="panel">
    <div class="panel__header">
      <div>
        <h2>Player</h2>
        <p class="panel__subtle">
          {{ playerType }} / {{ source?.deliveryType ?? 'unknown' }}
        </p>
      </div>
      <span class="panel__subtle">
        Last event: {{ lastEvent?.eventType ?? 'none yet' }}
      </span>
    </div>

    <p v-if="!source" class="empty-state">Choose a fixture to begin.</p>
    <template v-else>
      <p v-if="!source.available" class="panel__warning">
        Media output is not available yet. Run <code>scripts/generate-media.sh</code> after installing
        <code>ffmpeg</code>.
      </p>

      <p
        v-if="(playerType === 'native' || playerType === 'plyr') && source.deliveryType === 'hls'"
        class="panel__subtle"
      >
        Safari uses native HLS. Other browsers use <code>hls.js</code> in this lane.
      </p>
      <p v-if="snapshot.errorMessage" class="panel__warning">{{ snapshot.errorMessage }}</p>

      <div ref="containerRef" class="player-panel__surface" />

      <div class="player-panel__controls">
        <button type="button" @click="play" :disabled="controlsDisabled">Play</button>
        <button type="button" @click="pause" :disabled="controlsDisabled">Pause</button>
        <button type="button" @click="skipBy(-10)" :disabled="controlsDisabled">-10s</button>
        <button type="button" @click="skipBy(10)" :disabled="controlsDisabled">+10s</button>
      </div>

      <label class="player-panel__scrubber">
        <span>Seek</span>
        <input
          v-model="scrubberValue"
          type="range"
          min="0"
          :max="snapshot.duration ?? 0"
          step="0.1"
          :disabled="controlsDisabled || snapshot.duration === null"
          @change="onSeek"
        />
      </label>

      <dl class="player-panel__stats">
        <div>
          <dt>Current time</dt>
          <dd>{{ formatTime(snapshot.currentTime) }}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{{ formatTime(snapshot.duration) }}</dd>
        </div>
        <div>
          <dt>Buffered</dt>
          <dd>{{ formatTime(bufferedEnd) }}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{{ snapshot.paused ? 'paused' : 'playing' }}</dd>
        </div>
      </dl>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { PlayerType } from 'shared';

import type { MediaSourceDefinition } from '../lib/mediaSources';
import { createNativePlayer } from '../players/native/createNativePlayer';
import { createPlyrPlayer } from '../players/plyr/createPlyrPlayer';
import type { PlayerAdapter, PlayerAdapterEvent, PlayerSnapshot } from '../players/types';
import { createVideoJsPlayer } from '../players/videojs/createVideoJsPlayer';
import { usePlaybackSessionStore } from '../stores/playbackSession';
import { normalizePlaybackEvent } from '../tracking/normalizePlaybackEvent';
import {
  buildPlaybackEvent,
  createPlayRequestEvent,
  createSkipEvent,
  usePlaybackTracker
} from '../tracking/usePlaybackTracker';

const props = defineProps<{
  playerType: PlayerType;
  source: MediaSourceDefinition | null;
}>();

const store = usePlaybackSessionStore();
const tracker = usePlaybackTracker(store);
const containerRef = ref<HTMLElement | null>(null);
const adapter = ref<PlayerAdapter | null>(null);
const scrubberValue = ref(0);
const snapshot = ref<PlayerSnapshot>({
  currentTime: 0,
  duration: null,
  paused: true,
  bufferedRanges: [],
  errorMessage: null
});

const lastEvent = computed(() => store.events.at(-1) ?? null);
const bufferedEnd = computed(() => snapshot.value.bufferedRanges.at(-1)?.end ?? 0);
const controlsDisabled = computed(() => !props.source?.available || Boolean(snapshot.value.errorMessage));

const trackingContext = computed(() => {
  if (!props.source) {
    return null;
  }

  return {
    sessionId: store.sessionId,
    mediaId: props.source.mediaId,
    playerType: props.playerType,
    deliveryType: props.source.deliveryType,
    userAgent: navigator.userAgent
  };
});

const destroyAdapter = () => {
  adapter.value?.destroy();
  adapter.value = null;
};

const updateSnapshot = () => {
  snapshot.value = adapter.value?.getSnapshot() ?? {
    currentTime: 0,
    duration: null,
    paused: true,
    bufferedRanges: [],
    errorMessage: null
  };
  scrubberValue.value = snapshot.value.currentTime ?? 0;
};

const onAdapterEvent = (adapterEvent: PlayerAdapterEvent) => {
  updateSnapshot();

  if (!trackingContext.value) {
    return;
  }

  tracker.recordEvent(
    normalizePlaybackEvent({
      adapterEvent,
      ...trackingContext.value
    })
  );
};

const createAdapter = () => {
  const options = {
    container: containerRef.value as HTMLElement,
    onEvent: onAdapterEvent
  };

  switch (props.playerType) {
    case 'native':
      return createNativePlayer(options);
    case 'plyr':
      return createPlyrPlayer(options);
    case 'videojs':
    default:
      return createVideoJsPlayer(options);
  }
};

const mountPlayer = async () => {
  destroyAdapter();

  if (!containerRef.value || !props.source) {
    updateSnapshot();
    return;
  }

  adapter.value = createAdapter();
  await adapter.value.load({
    mediaId: props.source.mediaId,
    deliveryType: props.source.deliveryType,
    url: props.source.url,
    available: props.source.available
  });
  updateSnapshot();
};

const play = async () => {
  if (!adapter.value || !trackingContext.value) {
    return;
  }

  const currentSnapshot = adapter.value.getSnapshot();
  tracker.recordEvent(
    createPlayRequestEvent(
      trackingContext.value,
      currentSnapshot.currentTime,
      currentSnapshot.duration,
      currentSnapshot.bufferedRanges
    )
  );

  try {
    await adapter.value.play();
    updateSnapshot();
  } catch {
    tracker.recordEvent(
      buildPlaybackEvent(trackingContext.value, {
        eventType: 'error',
        currentTime: currentSnapshot.currentTime,
        duration: currentSnapshot.duration,
        bufferedRanges: currentSnapshot.bufferedRanges
      })
    );
  }
};

const pause = () => {
  adapter.value?.pause();
  updateSnapshot();
};

const skipBy = (delta: number) => {
  if (!adapter.value || !trackingContext.value) {
    return;
  }

  const currentSnapshot = adapter.value.getSnapshot();
  const fromTime = currentSnapshot.currentTime ?? 0;
  const duration = currentSnapshot.duration ?? Math.max(fromTime + delta, 0);
  const toTime = Math.max(0, Math.min(fromTime + delta, duration));
  const eventType = delta >= 0 ? 'skip_forward' : 'skip_backward';

  tracker.recordEvent(
    createSkipEvent(
      trackingContext.value,
      eventType,
      fromTime,
      toTime,
      currentSnapshot.duration,
      currentSnapshot.bufferedRanges
    )
  );
  adapter.value.seekTo(toTime, eventType);
  updateSnapshot();
};

const onSeek = () => {
  if (!adapter.value) {
    return;
  }

  adapter.value.seekTo(Number(scrubberValue.value), 'seek');
  updateSnapshot();
};

watch(
  () => [containerRef.value, props.playerType, props.source?.url, store.sessionId],
  () => {
    void mountPlayer();
  },
  { immediate: true, flush: 'post' }
);

onBeforeUnmount(() => {
  destroyAdapter();
});

function formatTime(value: number | null) {
  return value === null ? '--' : `${value.toFixed(1)}s`;
}
</script>
