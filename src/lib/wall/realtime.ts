/** Readers never open postgres_changes. Arrivals come from the public beat. */
export const WALL_READER_SUBSCRIBES_TO_POSTGRES = false;

export function realtimeEventFilter(eventId: string): string {
  return `event_id=eq.${eventId}`;
}

export function realtimeChannelName(eventId: string): string {
  return `wall-messages:${eventId}`;
}
