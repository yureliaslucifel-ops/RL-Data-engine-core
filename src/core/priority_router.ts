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

/**
 * HIGH = temps réel gameplay (STATE CRITIQUE)
 * SESSION = structure match / phases
 * NORMAL = infos secondaires
 */

const HIGH_PRIORITY_EVENTS = new Set<string>([
  // 🔴 CORE STATE REALTIME
  "UpdateState",
  "ClockUpdatedSeconds",

  // 🔴 GAMEPLAY EVENTS
  "GoalScored",
  "StatfeedEvent",
  "BallHit",
  "CrossbarHit",

  // 🔴 MATCH FLOW / CONTROL
  "MatchPaused",
  "MatchUnpaused",
  "CountdownBegin",

  // 🔴 REPLAY FLOW
  "ReplayCreated",
  "GoalReplayStart",
  "GoalReplayEnd",
  "GoalReplayWillEnd",

  // 🔴 END STATES
  "MatchEnded",
  "MatchDestroyed"
]);

const SESSION_EVENTS = new Set<string>([
  "MatchCreated",
  "MatchInitialized",
  "MatchEnded",
  "MatchDestroyed",
  "GoalScored",
  "ReplayCreated"
]);

export class PriorityRouter {
  route(event: EngineEvent): RoutedEvent {
    const priority = this.getPriority(event);

    const isUpdateState = event.type === "UpdateState";

    return {
      event,
      priority,
      targets: {
        // STATE ENGINE DOIT TOUJOURS recevoir UpdateState
        state: true,

        // session pour structure match
        session: SESSION_EVENTS.has(event.type) || isUpdateState,

        // collector pour stats (TOUT sauf bruit inutile)
        collector: true,

        // broadcast overlay
        broadcast: true
      }
    };
  }

  getPriority(event: EngineEvent): EventPriority {
    if (HIGH_PRIORITY_EVENTS.has(event.type)) {
      return "high";
    }

    if (SESSION_EVENTS.has(event.type)) {
      return "session";
    }

    return "normal";
  }
}
