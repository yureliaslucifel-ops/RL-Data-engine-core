import { EngineEvent, GoalScoredPayload, SessionState } from "../types";

export class SessionEngine {
  private session: SessionState = {
    goalCount: 0,
    goals: []
  };

  process(event: EngineEvent): void {
    const data = event.data as { MatchGuid?: string; WinnerTeamNum?: number };

    if (data.MatchGuid && data.MatchGuid !== this.session.matchGuid) {
      this.startSession(data.MatchGuid, event.timestamp, event.accountId);
    }

    if (event.type === "GoalScored") {
      this.session.goalCount += 1;
      this.session.goals.push(event as EngineEvent<GoalScoredPayload>);
      return;
    }

    if (event.type === "MatchEnded" || event.type === "MatchDestroyed") {
      this.session.endedAt = event.timestamp;
    }
  }

  getSnapshot(): SessionState {
    return {
      ...this.session,
      goals: [...this.session.goals]
    };
  }

  private startSession(matchGuid: string, timestamp: number, accountId?: string): void {
    this.session = {
      matchGuid,
      startedAt: timestamp,
      goalCount: 0,
      goals: [],
      accountId
    };
  }
}
