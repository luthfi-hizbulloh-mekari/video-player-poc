import { defineStore } from 'pinia';
import type { DeliveryType, PlaybackEvent, PlayerType } from 'shared';

import type { MediaFixture } from '../lib/mediaSources';
import { getAvailableDeliveryTypes, getSourceForDelivery } from '../lib/mediaSources';

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

function getDefaultDeliveryType(fixture: MediaFixture | null) {
  return fixture ? getAvailableDeliveryTypes(fixture)[0] ?? null : null;
}

export const usePlaybackSessionStore = defineStore('playback-session', {
  state: () => ({
    selectedPlayerType: 'native' as PlayerType,
    selectedDeliveryType: 'mp4' as DeliveryType,
    selectedMediaId: 'sample',
    fixtures: [] as MediaFixture[],
    generatedAt: null as string | null,
    events: [] as PlaybackEvent[],
    sessionId: createSessionId(),
    manifestError: null as string | null,
    postError: null as string | null
  }),
  getters: {
    selectedFixture(state) {
      return state.fixtures.find((fixture) => fixture.id === state.selectedMediaId) ?? state.fixtures[0] ?? null;
    },
    selectedSource(state) {
      const selectedFixture =
        state.fixtures.find((fixture) => fixture.id === state.selectedMediaId) ?? state.fixtures[0] ?? null;

      return selectedFixture
        ? getSourceForDelivery(selectedFixture, state.selectedDeliveryType)
        : null;
    }
  },
  actions: {
    setManifest(fixtures: MediaFixture[], generatedAt: string) {
      this.fixtures = fixtures;
      this.generatedAt = generatedAt;

      if (!this.fixtures.some((fixture) => fixture.id === this.selectedMediaId) && this.fixtures[0]) {
        this.selectedMediaId = this.fixtures[0].id;
      }

      const selectedFixture =
        this.fixtures.find((fixture) => fixture.id === this.selectedMediaId) ?? this.fixtures[0] ?? null;
      const availableDeliveries = selectedFixture ? getAvailableDeliveryTypes(selectedFixture) : [];

      if (!availableDeliveries.includes(this.selectedDeliveryType)) {
        const fallbackDeliveryType = getDefaultDeliveryType(selectedFixture);

        if (fallbackDeliveryType) {
          this.selectedDeliveryType = fallbackDeliveryType;
        }
      }

      this.manifestError = null;
    },
    setManifestError(message: string) {
      this.manifestError = message;
    },
    setSelectedPlayerType(value: PlayerType) {
      this.selectedPlayerType = value;
      this.resetSession();
    },
    setSelectedDeliveryType(value: DeliveryType) {
      this.selectedDeliveryType = value;
      this.resetSession();
    },
    setSelectedMediaId(value: string) {
      this.selectedMediaId = value;

      const selectedFixture =
        this.fixtures.find((fixture) => fixture.id === this.selectedMediaId) ?? this.fixtures[0] ?? null;
      const availableDeliveries = selectedFixture ? getAvailableDeliveryTypes(selectedFixture) : [];

      if (!availableDeliveries.includes(this.selectedDeliveryType)) {
        const fallbackDeliveryType = getDefaultDeliveryType(selectedFixture);

        if (fallbackDeliveryType) {
          this.selectedDeliveryType = fallbackDeliveryType;
        }
      }

      this.resetSession();
    },
    addEvent(event: PlaybackEvent) {
      this.events.push(event);
    },
    setPostError(message: string | null) {
      this.postError = message;
    },
    resetSession() {
      this.events = [];
      this.postError = null;
      this.sessionId = createSessionId();
    }
  }
});
