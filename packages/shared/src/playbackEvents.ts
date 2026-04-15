import { z } from 'zod';

export const playerTypeSchema = z.enum(['native', 'videojs', 'plyr']);
export type PlayerType = z.infer<typeof playerTypeSchema>;

export const deliveryTypeSchema = z.enum(['mp4', 'hls', 'youtube']);
export type DeliveryType = z.infer<typeof deliveryTypeSchema>;

export const playbackEventTypeSchema = z.enum([
  'play_request',
  'playing',
  'pause',
  'seek_start',
  'seek_end',
  'skip_forward',
  'skip_backward',
  'buffer_start',
  'buffer_end',
  'ended',
  'error'
]);
export type PlaybackEventType = z.infer<typeof playbackEventTypeSchema>;

export const bufferedRangeSchema = z.object({
  start: z.number(),
  end: z.number()
});
export type BufferedRange = z.infer<typeof bufferedRangeSchema>;

const nullableNumber = z.number().nullable();

export const playbackEventSchema = z.object({
  eventType: playbackEventTypeSchema,
  sessionId: z.string().min(1),
  mediaId: z.string().min(1),
  playerType: playerTypeSchema,
  deliveryType: deliveryTypeSchema,
  currentTime: nullableNumber,
  fromTime: nullableNumber,
  toTime: nullableNumber,
  deltaSeconds: nullableNumber,
  duration: nullableNumber,
  occurredAt: z.string().datetime(),
  bufferedRanges: z.array(bufferedRangeSchema),
  userAgent: z.string().min(1)
});

export type PlaybackEvent = z.infer<typeof playbackEventSchema>;

export const playbackEventBatchSchema = z.object({
  events: z.array(playbackEventSchema).min(1)
});

export type PlaybackEventBatch = z.infer<typeof playbackEventBatchSchema>;
