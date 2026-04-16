import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePlaybackSessionStore } from "../stores/playbackSession";

describe("PlayerComparisonPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          fixtures: [
            {
              id: "sample",
              label: "Sample clip",
              description: "Fixture",
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
                mux: {
                  url: "https://stream.mux.com/wZuyI8vwgDB9dkKmx1OpO574uA7YJO7NA3A8Mz66lZU.m3u8",
                  relativePath: "wZuyI8vwgDB9dkKmx1OpO574uA7YJO7NA3A8Mz66lZU",
                  available: true,
                },
              },
            },
          ],
          generatedAt: "2026-04-15T10:00:00.000Z",
        }),
      }),
    );
  });

  it("loads the manifest, switches delivery lanes, and records playback events", async () => {
    const { default: PlayerComparisonPage } =
      await import("../pages/PlayerComparisonPage.vue");
    const wrapper = mount(PlayerComparisonPage, {
      global: {
        stubs: {
          PlayerPanel: {
            template: '<div data-test="player-panel">player panel</div>',
            props: ["playerType", "source"],
          },
        },
      },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();

    const selects = wrapper.findAll("select");
    await selects[0]?.setValue("mux");
    await selects[1]?.setValue("mux");

    const store = usePlaybackSessionStore();
    store.addEvent({
      eventType: "play_request",
      sessionId: store.sessionId,
      mediaId: "sample",
      playerType: "mux",
      deliveryType: "mux",
      currentTime: 0,
      fromTime: null,
      toTime: null,
      deltaSeconds: null,
      duration: 120,
      occurredAt: "2026-04-15T10:00:00.000Z",
      bufferedRanges: [],
      userAgent: "vitest",
    });
    await wrapper.vm.$nextTick();

    expect(store.selectedPlayerType).toBe("mux");
    expect(store.selectedDeliveryType).toBe("mux");
    expect(wrapper.text()).toContain("play_request");
    expect(wrapper.find('[data-test="player-panel"]').exists()).toBe(true);
  });
});
