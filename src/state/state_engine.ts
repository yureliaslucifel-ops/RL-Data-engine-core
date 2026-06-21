import { EngineEvent, MatchState, UpdateStatePayload } from "../types";
import { createInitialMatchState } from "./match_state";

export class StateEngine {
  private state = createInitialMatchState();

  setRocketLeagueConnection(connected: boolean): void {
    this.state = {
      ...this.state,
      connectedToRocketLeague: connected
    };
  }

  update(event: EngineEvent): void {
    this.state.lastEventAt = event.timestamp;

    if (event.type === "UpdateState") {
      this.applyUpdateState(event.data as UpdateStatePayload);
    }
  }

  getSnapshot(): MatchState {
    return {
      ...this.state,
      players: [...this.state.players],
      teams: [...this.state.teams]
    };
  }

  private applyUpdateState(payload: UpdateStatePayload): void {
    this.state = {
      ...this.state,
      matchGuid: payload.MatchGuid ?? this.state.matchGuid,
      game: payload.Game ?? this.state.game,
      players: payload.Players ?? this.state.players,
      teams: payload.Game?.Teams ?? this.state.teams
    };
  }
}
