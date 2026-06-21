import { MatchState } from "../types";

export function createInitialMatchState(): MatchState {
  return {
    connectedToRocketLeague: false,
    players: [],
    teams: []
  };
}
