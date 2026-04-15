import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { usePlaybackSessionStore } from "../stores/playbackSession";

const sampleFixture = {
  id: "sample",
  label: "Sample clip",
  description: "Local fixture",
  sources: {
    mp4: {
      url: "/media/mp4/sample.mp4",
      relativePath: "mp4/sample.mp4",
      available: true,
    },
    hls: {
      url: "/media/hls/sample/master.m3u8",
      relativePath: "hls/sample/master.m3u8",
      available: true,
    },
  },
};

const mp4OnlyFixture = {
  id: "mp4-only",
  label: "MP4 only",
  description: "Single-format fixture",
  sources: {
    mp4: {
      url: "/media/mp4/other.mp4",
      relativePath: "mp4/other.mp4",
      available: true,
    },
  },
};

describe("playbackSession store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("falls back to the first delivery available on the selected fixture", () => {
    const store = usePlaybackSessionStore();

    store.setManifest(
      [sampleFixture, mp4OnlyFixture],
      "2026-04-15T10:00:00.000Z",
    );
    store.setSelectedDeliveryType("hls");
    store.setSelectedMediaId("mp4-only");

    expect(store.selectedDeliveryType).toBe("mp4");
    expect(store.selectedSource?.url).toBe("/media/mp4/other.mp4");
  });

  it("returns null when the requested delivery is missing from the fixture", () => {
    const store = usePlaybackSessionStore();

    store.fixtures = [mp4OnlyFixture];
    store.selectedMediaId = "mp4-only";
    store.selectedDeliveryType = "hls";

    expect(store.selectedSource).toBeNull();
  });
});
