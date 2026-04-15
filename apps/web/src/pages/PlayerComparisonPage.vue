<template>
  <main class="page-shell">
    <section class="hero">
      <p class="eyebrow">Video playback comparison</p>
      <h1>Native video vs Video.js vs Plyr</h1>
      <p class="hero__copy">
        Compare MP4 and HLS playback while capturing a normalized event stream for play, pause,
        seek, skip, buffering, and end-of-session states.
      </p>
    </section>

    <section class="panel">
      <div class="panel__header">
        <h2>Comparison Controls</h2>
        <span class="panel__subtle">
          Manifest refreshed: {{ store.generatedAt ? formatTimestamp(store.generatedAt) : 'not yet loaded' }}
        </span>
      </div>

      <p v-if="store.manifestError" class="panel__warning">{{ store.manifestError }}</p>
      <p v-if="store.postError" class="panel__warning">Event ingestion warning: {{ store.postError }}</p>

      <div class="form-grid">
        <label>
          <span>Lane</span>
          <select :value="store.selectedPlayerType" @change="onPlayerChange">
            <option value="native">native</option>
            <option value="videojs">videojs</option>
            <option value="plyr">plyr</option>
          </select>
        </label>

        <label>
          <span>Delivery</span>
          <select :value="store.selectedDeliveryType" @change="onDeliveryChange">
            <option v-for="delivery in availableDeliveries" :key="delivery" :value="delivery">
              {{ delivery }}
            </option>
          </select>
        </label>

        <label>
          <span>Fixture</span>
          <select :value="store.selectedMediaId" @change="onMediaChange">
            <option v-for="fixture in store.fixtures" :key="fixture.id" :value="fixture.id">
              {{ fixture.label }}
            </option>
          </select>
        </label>
      </div>

      <p class="panel__subtle" v-if="selectedSource">
        Source URL: <code>{{ selectedSource.url }}</code>
      </p>
      <p class="panel__subtle" v-if="selectedSource && !selectedSource.available">
        Fixtures are missing in <code>media/output</code>. Generate them locally once
        <code>ffmpeg</code> is installed.
      </p>
    </section>

    <section class="summary-grid">
      <article class="summary-card">
        <span>Startup to first playing</span>
        <strong>{{ formatDuration(summary.timeToFirstPlayingMs) }}</strong>
      </article>
      <article class="summary-card">
        <span>Total buffering count</span>
        <strong>{{ summary.bufferCount }}</strong>
      </article>
      <article class="summary-card">
        <span>Cumulative buffering</span>
        <strong>{{ formatDuration(summary.bufferDurationMs) }}</strong>
      </article>
      <article class="summary-card">
        <span>Last seek delta</span>
        <strong>{{ formatSeconds(summary.lastSeekDeltaSeconds) }}</strong>
      </article>
    </section>

    <section class="content-grid">
      <PlayerPanel
        :key="playerPanelKey"
        :player-type="store.selectedPlayerType"
        :source="selectedSource"
      />
      <EventLogPanel :events="store.events" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';

import EventLogPanel from '../components/EventLogPanel.vue';
import PlayerPanel from '../components/PlayerPanel.vue';
import { fetchMediaManifest, getAvailableDeliveryTypes } from '../lib/mediaSources';
import { usePlaybackSessionStore } from '../stores/playbackSession';

const store = usePlaybackSessionStore();

const selectedSource = computed(() => store.selectedSource);
const availableDeliveries = computed(() =>
  store.selectedFixture ? getAvailableDeliveryTypes(store.selectedFixture) : []
);
const playerPanelKey = computed(
  () =>
    `${store.selectedPlayerType}-${store.selectedDeliveryType}-${store.selectedMediaId}-${store.sessionId}`
);

const summary = computed(() => {
  const playRequest = store.events.find((event) => event.eventType === 'play_request');
  const firstPlaying = store.events.find((event) => event.eventType === 'playing');
  const timeToFirstPlayingMs =
    playRequest && firstPlaying
      ? Date.parse(firstPlaying.occurredAt) - Date.parse(playRequest.occurredAt)
      : null;

  const bufferStarts = store.events.filter((event) => event.eventType === 'buffer_start');
  let bufferDurationMs = 0;
  let openBufferStart: string | null = null;

  for (const event of store.events) {
    if (event.eventType === 'buffer_start') {
      openBufferStart = event.occurredAt;
    }

    if (event.eventType === 'buffer_end' && openBufferStart) {
      bufferDurationMs += Date.parse(event.occurredAt) - Date.parse(openBufferStart);
      openBufferStart = null;
    }
  }

  const lastSeekDeltaSeconds =
    [...store.events].reverse().find((event) => event.eventType === 'seek_end')?.deltaSeconds ?? null;

  return {
    timeToFirstPlayingMs,
    bufferCount: bufferStarts.length,
    bufferDurationMs,
    lastSeekDeltaSeconds
  };
});

const loadManifest = async () => {
  try {
    const manifest = await fetchMediaManifest();
    store.setManifest(manifest.fixtures, manifest.generatedAt);
  } catch (error) {
    store.setManifestError(error instanceof Error ? error.message : 'Failed to load media manifest');
  }
};

const onPlayerChange = (event: Event) => {
  store.setSelectedPlayerType((event.target as HTMLSelectElement).value as typeof store.selectedPlayerType);
};

const onDeliveryChange = (event: Event) => {
  store.setSelectedDeliveryType(
    (event.target as HTMLSelectElement).value as typeof store.selectedDeliveryType
  );
};

const onMediaChange = (event: Event) => {
  store.setSelectedMediaId((event.target as HTMLSelectElement).value);
};

onMounted(() => {
  void loadManifest();
});

function formatDuration(value: number | null) {
  return value === null ? '--' : `${(value / 1000).toFixed(2)}s`;
}

function formatSeconds(value: number | null) {
  return value === null ? '--' : `${value.toFixed(1)}s`;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString();
}
</script>
