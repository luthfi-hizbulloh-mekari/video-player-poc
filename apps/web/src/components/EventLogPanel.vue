<template>
  <section class="panel">
    <div class="panel__header">
      <h2>Event Log</h2>
      <span class="panel__subtle">{{ events.length }} events</span>
    </div>

    <p v-if="events.length === 0" class="empty-state">
      Playback events will appear here after you interact with the player.
    </p>

    <div v-else class="event-log">
      <article v-for="event in events" :key="`${event.occurredAt}-${event.eventType}`" class="event-log__row">
        <div>
          <strong>{{ event.eventType }}</strong>
          <div class="panel__subtle">
            {{ event.playerType }} / {{ event.deliveryType }} / {{ event.mediaId }}
          </div>
        </div>
        <div class="event-log__meta">
          <span>{{ formatTime(event.currentTime) }}</span>
          <span v-if="event.deltaSeconds !== null">delta {{ event.deltaSeconds.toFixed(1) }}s</span>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PlaybackEvent } from 'shared';

defineProps<{
  events: PlaybackEvent[];
}>();

function formatTime(value: number | null) {
  return value === null ? '--' : `${value.toFixed(1)}s`;
}
</script>
