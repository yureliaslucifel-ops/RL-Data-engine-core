export type JsonObject = Record<string, unknown>;

export interface RocketLeagueMessage {
  Event: string;
  Data?: unknown;
}

export interface EngineEvent<TData = unknown> {
  type: string;
  timestamp: number;
  data: TData;
}

export interface PlayerState {
  Name: string;
  PrimaryId?: string;
  Shortcut?: number;
  TeamNum: number;
  Score?: number;
  Goals?: number;
  Shots?: number;
  Assists?: number;
  Saves?: number;
  Touches?: number;
  Demos?: number;
  Boost?: number;
  Speed?: number;
  bBoosting?: boolean;
  bOnGround?: boolean;
  bOnWall?: boolean;
  bDemolished?: boolean;
  bSupersonic?: boolean;
}

export interface TeamState {
  Name?: string;
  TeamNum: number;
  Score: number;
  ColorPrimary?: string;
  ColorSecondary?: string;
}

export interface BallState {
  Speed?: number;
  TeamNum?: number;
}

export interface GameState {
  Teams?: TeamState[];
  TimeSeconds?: number;
  bOvertime?: boolean;
  bReplay?: boolean;
  bHasWinner?: boolean;
  Winner?: string;
  Arena?: string;
  Ball?: BallState;
  Target?: {
    Name?: string;
    Shortcut?: number;
    TeamNum?: number;
  };
}

export interface UpdateStatePayload {
  MatchGuid?: string;
  Players?: PlayerState[];
  Game?: GameState;
}

export interface GoalScoredPayload {
  MatchGuid?: string;
  GoalSpeed?: number;
  GoalTime?: number;
  Scorer?: {
    Name: string;
    Shortcut?: number;
    TeamNum: number;
  };
  Assister?: {
    Name: string;
    Shortcut?: number;
    TeamNum: number;
  };
}

export interface MatchState {
  matchGuid?: string;
  connectedToRocketLeague: boolean;
  lastEventAt?: number;
  game?: GameState;
  players: PlayerState[];
  teams: TeamState[];
}

export interface SessionState {
  matchGuid?: string;
  startedAt?: number;
  endedAt?: number;
  goalCount: number;
  goals: EngineEvent<GoalScoredPayload>[];
}

export interface OverlaySnapshot {
  type: "snapshot";
  timestamp: number;
  state: MatchState;
  session: SessionState;
}

export interface OverlayEventMessage {
  type: "event";
  timestamp: number;
  event: EngineEvent;
  snapshot: OverlaySnapshot;
}

export type EventPriority = "high" | "normal" | "session";

export interface StoredMatchEvent {
  matchGuid?: string;
  eventType: string;
  timestamp: number;
  priority: EventPriority;
  payload: unknown;
}
