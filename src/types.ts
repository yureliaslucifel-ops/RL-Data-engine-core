export type JsonObject = Record<string, unknown>;

export interface RocketLeagueMessage {
  Event: string;
  Data?: unknown;
}

export interface EngineEvent<TData = unknown> {
  type: string;
  timestamp: number;
  data: TData;
  // optional account id (new) - present if the message includes account identification
  accountId?: string;
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
    PrimaryId?: string;
  };
  Assister?: {
    Name: string;
    Shortcut?: number;
    TeamNum?: number;
    PrimaryId?: string;
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
  // optional account id attached to this session
  accountId?: string;
}

/**
 * Added: match and account/season stats types
 */
export interface PlayerMatchStats {
  name: string;
  primaryId?: string;
  teamNum: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  touches?: number;
  demos?: number;
  score?: number;
}

export interface MatchStats {
  matchGuid?: string;
  score?: { [teamNum: number]: number };
  durationSeconds?: number;
  goalsTotal?: number;
  players: PlayerMatchStats[];
  startedAt?: number;
  endedAt?: number;
}

export interface AccountStats {
  accountId: string;
  matchesPlayed?: number;
  goals?: number;
  assists?: number;
  saves?: number;
  shots?: number;
  // aggregated by mode/season can be added later
}

export interface Season {
  seasonId: string;
  seasonName?: string;
  start?: number;
  end?: number;
}

export interface OverlaySnapshot {
  type: "snapshot";
  timestamp: number;
  state: MatchState;
  session: SessionState;
  // new optional fields, kept optional to maintain compatibility
  matchStats?: MatchStats;
  accountStats?: AccountStats[]; // per account
  season?: Season | null;
  seasonStats?: { [seasonId: string]: AccountStats } | null;
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
  accountId?: string;
  seasonId?: string;
}
