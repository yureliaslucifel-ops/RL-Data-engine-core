import { OverlaySnapshot, MatchStats, PlayerMatchStats, AccountStats } from "../types";
import { SessionEngine } from "../session/session_engine";
import { StateEngine } from "../state/state_engine";
import { SeasonManager } from "../season/season_manager";
import { accountManager } from "../accounts/account_manager";

export class SnapshotBuilder {
  constructor(
    private readonly stateEngine: StateEngine,
    private readonly sessionEngine: SessionEngine,
    private readonly seasonManager: SeasonManager = new SeasonManager()
  ) {}

  buildFullSnapshot(): OverlaySnapshot {
    const state = this.stateEngine.getSnapshot();
    const session = this.sessionEngine.getSnapshot();
    const matchStats = buildMatchStats(state, session);
    const season = this.seasonManager.getCurrentSeason();

    // build accountStats by mapping players to accounts
    const accountStats: AccountStats[] = [];
    const players = matchStats.players || [];
    for (const p of players) {
      const primary = p.primaryId;
      const entry = primary ? accountManager.findByPrimaryId(primary) : accountManager.list().find((e: any) => e.name === p.name || e.displayName === p.name);
      const accountId = entry ? entry.accountId : undefined;
      if (accountId) {
        const existing = accountStats.find((a) => a.accountId === accountId);
        if (existing) {
          existing.matchesPlayed = (existing.matchesPlayed || 0) + 1;
          existing.goals = (existing.goals || 0) + (p.goals || 0);
          existing.assists = (existing.assists || 0) + (p.assists || 0);
          existing.saves = (existing.saves || 0) + (p.saves || 0);
          existing.shots = (existing.shots || 0) + (p.shots || 0);
        } else {
          accountStats.push({
            accountId,
            matchesPlayed: 1,
            goals: p.goals || 0,
            assists: p.assists || 0,
            saves: p.saves || 0,
            shots: p.shots || 0
          });
        }
      }
    }

    const seasonStats = season ? accountStats.reduce((acc, cur) => {
      acc[season.seasonId] = acc[season.seasonId] || {} as any;
      acc[season.seasonId][cur.accountId] = cur;
      return acc;
    }, {} as any) : undefined;

    return {
      type: "snapshot",
      timestamp: Date.now(),
      state,
      session,
      matchStats,
      accountStats: accountStats.length ? accountStats : undefined,
      season: season ?? null,
      seasonStats: seasonStats ?? undefined
    };
  }

  build(): OverlaySnapshot {
    return this.buildFullSnapshot();
  }
}

function buildMatchStats(state: any, session: any): MatchStats {
  const startedAt = session.startedAt;
  const endedAt = session.endedAt;
  const durationSeconds = startedAt && endedAt ? Math.max(0, Math.floor((endedAt - startedAt) / 1000)) : undefined;

  const players: PlayerMatchStats[] = (state.players || []).map((p: any) => ({
    name: p.Name,
    primaryId: p.PrimaryId,
    teamNum: p.TeamNum,
    goals: typeof p.Goals === "number" ? p.Goals : 0,
    assists: typeof p.Assists === "number" ? p.Assists : 0,
    saves: typeof p.Saves === "number" ? p.Saves : 0,
    shots: typeof p.Shots === "number" ? p.Shots : 0,
    touches: p.Touches,
    demos: p.Demos,
    score: p.Score
  }));

  const goalsTotal = session.goalCount ?? (players.reduce((c, p) => c + (p.goals || 0), 0));

  const score: { [teamNum: number]: number } = {};
  (state.teams || []).forEach((t: any) => { score[t.TeamNum] = t.Score ?? 0; });

  return {
    matchGuid: state.matchGuid ?? session.matchGuid,
    score,
    durationSeconds,
    goalsTotal,
    players,
    startedAt,
    endedAt
  };
}
