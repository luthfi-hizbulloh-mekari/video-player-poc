import type { BufferedRange, DeliveryType } from 'shared';

export type PlayerAdapterEventType =
  | 'play_request'
  | 'playing'
  | 'pause'
  | 'seek_start'
  | 'seek_end'
  | 'buffer_start'
  | 'buffer_end'
  | 'ended'
  | 'error';

export type PlayerAdapterEvent = {
  type: PlayerAdapterEventType;
  currentTime: number | null;
  duration: number | null;
  bufferedRanges: BufferedRange[];
  fromTime?: number | null;
  toTime?: number | null;
  deltaSeconds?: number | null;
  errorMessage?: string | null;
};

export type PlayerSnapshot = {
  currentTime: number | null;
  duration: number | null;
  paused: boolean;
  bufferedRanges: BufferedRange[];
  errorMessage: string | null;
};

export type SeekIntent = 'seek' | 'skip_forward' | 'skip_backward';

export type PlayerSource = {
  mediaId: string;
  deliveryType: DeliveryType;
  url: string;
  relativePath: string;
  available: boolean;
};

export type PlayerAdapterOptions = {
  container: HTMLElement;
  onEvent: (event: PlayerAdapterEvent) => void;
};

export type PlayerAdapter = {
  load(source: PlayerSource): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seekTo(nextTime: number, intent: SeekIntent): void;
  getSnapshot(): PlayerSnapshot;
  destroy(): void;
};
