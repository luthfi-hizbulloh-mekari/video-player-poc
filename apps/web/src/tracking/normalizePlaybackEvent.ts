import type { PlaybackEvent, PlayerType } from 'shared';
import type { DeliveryType } from 'shared';

import type { PlayerAdapterEvent } from '../players/types';

export type NormalizePlaybackEventInput = {
  adapterEvent: PlayerAdapterEvent;
  sessionId: string;
  mediaId: string;
  playerType: PlayerType;
  deliveryType: DeliveryType;
  userAgent: string;
};

export function normalizePlaybackEvent({
  adapterEvent,
  sessionId,
  mediaId,
  playerType,
  deliveryType,
  userAgent
}: NormalizePlaybackEventInput): PlaybackEvent {
  return {
    eventType: adapterEvent.type,
    sessionId,
    mediaId,
    playerType,
    deliveryType,
    currentTime: adapterEvent.currentTime,
    fromTime: adapterEvent.fromTime ?? null,
    toTime: adapterEvent.toTime ?? null,
    deltaSeconds: adapterEvent.deltaSeconds ?? null,
    duration: adapterEvent.duration,
    occurredAt: new Date().toISOString(),
    bufferedRanges: adapterEvent.bufferedRanges,
    userAgent
  };
}
