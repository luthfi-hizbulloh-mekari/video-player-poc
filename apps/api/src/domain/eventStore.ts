import type { PlaybackEvent } from 'shared';

export class EventStore {
  private readonly events: PlaybackEvent[] = [];

  addMany(events: PlaybackEvent[]) {
    this.events.push(...events);
  }

  list() {
    return [...this.events];
  }

  clear() {
    this.events.length = 0;
  }
}
