import { EngineEvent, EventPriority } from "../types";

export interface RoutedEvent {
  event: EngineEvent;
  priority: EventPriority;
  targets: {
    state: boolean;
    session: boolean;
    collector: boolean;
    broadcast: boolean;
  };
}

const HIGH_PRIORITY_EVENTS = new Set([
  "GoalScored",
  "MatchEnded",
  "MatchDestroyed",
  "ReplayStart",
  "ReplayEnd"
]);

const SESSION_EVENTS = new Set([
  "MatchCreated",
  "MatchInitialized",
  "MatchEnded",
  "MatchDestroyed",
  "GoalScored"
]);

export class PriorityRouter {
  route(event: EngineEvent): RoutedEvent {
    const priority = this.getPriority(event);

    return {
      event,
      priority,
      targets: {
        state: event.type === "UpdateState",
        session: SESSION_EVENTS.has(event.type) || event.type === "UpdateState",
        collector: event.type !== "UpdateState",
        broadcast: true
      }
    };
  }

  getPriority(event: EngineEvent): EventPriority {
    if (SESSION_EVENTS.has(event.type)) {
      return "session";
    }

    if (HIGH_PRIORITY_EVENTS.has(event.type)) {
      return "high";
    }

    return "normal";
  }
}
