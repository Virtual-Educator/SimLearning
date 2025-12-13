export type AttemptEvent = {
  type:
    | 'grid_toggled'
    | 'pin_mode_toggled'
    | 'pin_added'
    | 'pin_removed'
    | 'view_reset'
    | 'zoom_changed'
    | 'pan_changed'
    | string;
  payload?: Record<string, unknown>;
  timestamp: number;
};

const attemptEvents: AttemptEvent[] = [];

export function logEvent(type: AttemptEvent['type'], payload?: AttemptEvent['payload']) {
  const event: AttemptEvent = {
    type,
    payload,
    timestamp: Date.now(),
  };
  attemptEvents.push(event);
  return event;
}

export function getAttemptEvents() {
  return attemptEvents;
}
