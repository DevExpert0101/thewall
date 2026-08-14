export function realtimeEventFilter(eventId: string): string {
  return `event_id=eq.${eventId}`;
}

export function realtimeChannelName(eventId: string): string {
  return `wall-messages:${eventId}`;
}
