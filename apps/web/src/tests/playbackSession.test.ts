import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePlaybackSessionStore } from '../stores/playbackSession';

const sampleFixture = {
  id: 'sample',
  label: 'Sample clip',
  description: 'Local fixture',
  sources: {
    mp4: {
      url: '/media/mp4/sample.mp4',
      relativePath: 'mp4/sample.mp4',
      available: true
    },
    hls: {
      url: '/media/hls/sample/master.m3u8',
      relativePath: 'hls/sample/master.m3u8',
      available: true
    }
  }
};

const youtubeFixture = {
  id: 'youtube-sample',
  label: 'YouTube sample',
  description: 'Remote fixture',
  sources: {
    youtube: {
      url: 'https://www.youtube.com/watch?v=NOiyDlWl534',
      relativePath: 'NOiyDlWl534',
      available: true
    }
  }
};

describe('playbackSession store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('falls back to the first delivery available on the selected fixture', () => {
    const store = usePlaybackSessionStore();

    store.setManifest([sampleFixture, youtubeFixture], '2026-04-15T10:00:00.000Z');
    store.setSelectedDeliveryType('hls');
    store.setSelectedMediaId('youtube-sample');

    expect(store.selectedDeliveryType).toBe('youtube');
    expect(store.selectedSource?.url).toBe('https://www.youtube.com/watch?v=NOiyDlWl534');
  });

  it('returns null when the requested delivery is missing from the fixture', () => {
    const store = usePlaybackSessionStore();

    store.fixtures = [youtubeFixture];
    store.selectedMediaId = 'youtube-sample';
    store.selectedDeliveryType = 'mp4';

    expect(store.selectedSource).toBeNull();
  });
});
