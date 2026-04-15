import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createNativePlayer } from '../players/native/createNativePlayer';

beforeEach(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn()
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value: vi.fn()
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined)
  });
});

describe('createNativePlayer', () => {
  it('mounts a metadata-preloading video element and reports missing fixtures', async () => {
    const container = document.createElement('div');
    const onEvent = vi.fn();
    const adapter = createNativePlayer({ container, onEvent });

    const video = container.querySelector('video');

    expect(video).not.toBeNull();
    expect(video?.getAttribute('crossorigin')).toBe('anonymous');
    expect(video?.getAttribute('preload')).toBe('metadata');

    await adapter.load({
      mediaId: 'sample',
      deliveryType: 'mp4',
      url: '/media/mp4/sample.mp4',
      available: false
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error'
      })
    );
  });
});
