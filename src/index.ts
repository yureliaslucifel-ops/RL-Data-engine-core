import { RLStatsAPI } from "./api/rl_stats_api";
import { MatchCollector } from "./collectors/match_collector";
import { loadConfig } from "./config";
import { EventBus } from "./core/event_bus";
import { PriorityRouter } from "./core/priority_router";
import { SessionEngine } from "./session/session_engine";
import { StateEngine } from "./state/state_engine";
import { SnapshotBuilder } from "./websocket/snapshot_builder";
import { startWebSocketServer } from "./websocket/ws_server";
import { logger } from "./utils/logger";
import { SeasonManager } from "./season/season_manager";
import { accountManager } from "./accounts/account_manager";
import { AccountStats } from "./types";

import WALStore from "./storage/wal-store";
import { StorageEngine } from "./storage/storage_engine";

const config = loadConfig();


// =====================
// RL STATS API
// =====================
const rlStatsApi = new RLStatsAPI({
  host: config.rlStatsHost,
  port: config.rlStatsPort,
  reconnectDelayMs: 3000
});


// =====================
// CORE SYSTEMS
// =====================
const eventBus = new EventBus();
const stateEngine = new StateEngine();
const sessionEngine = new SessionEngine();
const matchCollector = new MatchCollector();
const priorityRouter = new PriorityRouter();
const seasonManager = new SeasonManager();

const snapshotBuilder = new SnapshotBuilder(
  stateEngine,
  sessionEngine,
  seasonManager
);


// =====================
// STORAGE (FIX PATH IMPORTANT)
// =====================
const walStore = new WALStore({
  dir: "H:\\data"
});

const storageEngine = new StorageEngine(walStore);


// =====================
// DEBUG: TRACK EVENTS (IMPORTANT)
// =====================
let eventCount = 0;


// =====================
// RL API EVENTS
// =====================
rlStatsApi.on("connect", ({ url }) => {
  stateEngine.setRocketLeagueConnection(true);
  logger.info(`Connected to RL Stats API at ${url}`);
});

rlStatsApi.on("disconnect", () => {
  stateEngine.setRocketLeagueConnection(false);
logger.info("Disconnected from RL Stats API");
});

rlStatsApi.on("error", (error) => {
  logger.error("RL Stats API error", error);
});


// =====================
// MAIN PIPELINE
// =====================
rlStatsApi.on("event", (event) => {
  eventCount++;

  const routed = priorityRouter.route(event);

  // DEBUG IMPORTANT (sinon tu vois rien dans WAL)
  logger.info(`[EVENT ${eventCount}] ${event.type}`);

  // STATE
  if (routed.targets.state) {
    stateEngine.update(routed.event);
  }

  // SESSION
  if (routed.targets.session) {
    sessionEngine.process(routed.event);
  }

  // COLLECTOR
  if (routed.targets.collector) {
    matchCollector.collect(routed.event);
  }

  // STORAGE FIX (IMPORTANT)
  // 👉 tu stockes TOUT ce qui est important, pas seulement high/session
  if (
    routed.priority === "high" ||
    routed.priority === "session" ||
    event.type === "UpdateState" ||
    event.type === "GoalScored" ||
    event.type === "MatchEnded" ||
    event.type === "MatchDestroyed" ||
    event.type === "ClockUpdatedSeconds"
  ) {
    storageEngine.persistEvent(routed.event, routed.priority);
  }

  // =====================
  // MATCH END LOGIC
  // =====================
  if (event.type === "MatchEnded" || event.type === "MatchDestroyed") {
    const snapshot = snapshotBuilder.buildFullSnapshot();

    let winningTeamNum: number | undefined;

    const scoreMap = snapshot.matchStats?.score;
    if (scoreMap) {
      const sorted = Object.entries(scoreMap)
        .map(([teamNum, score]) => ({
          teamNum: Number(teamNum),
          score: Number(score)
        }))
        .sort((a, b) => b.score - a.score);

      if (sorted.length) winningTeamNum = sorted[0].teamNum;
    }

    const players = snapshot.matchStats?.players || [];

    const winningPlayers =
      typeof winningTeamNum === "number"
        ? players.filter((p) => p.teamNum === winningTeamNum)
        : [];

    const maxScore = Math.max(
      ...winningPlayers.map((p) => p.score || 0),
      0
    );

    const deltas: AccountStats[] = [];

    for (const p of players) {
      const entry = p.primaryId
        ? accountManager.findByPrimaryId(p.primaryId)
        : accountManager.list().find(
            (e: any) => e.name === p.name || e.displayName === p.name
          );

      if (!entry) continue;

      const isMvp =
        p.teamNum === winningTeamNum &&
        (p.score || 0) === maxScore;

      deltas.push({
        accountId: entry.accountId,
        matchesPlayed: 1,
        goals: p.goals || 0,
        assists: p.assists || 0,
        saves: p.saves || 0,
        shots: p.shots || 0,
        mvpCount: isMvp ? 1 : 0
      });
    }

    const seasonId = seasonManager.getCurrentSeason()?.seasonId;

    if (deltas.length) {
      storageEngine.updateAccountStats?.(deltas, seasonId);
    }

    storageEngine.persistSnapshot(snapshot);

    logger.info(
      `Match ended → snapshot saved | players=${players.length}`
    );
  }

  // BROADCAST
  if (routed.targets.broadcast) {
    eventBus.publish(routed.event);
  }
});


// =====================
// BOOTSTRAP
// =====================
async function bootstrap(): Promise<void> {
  try {
    await storageEngine.init();
    logger.info("Storage ready at H:\\data");
  } catch (err) {
    logger.error("Storage init failed", err);
  }

  startWebSocketServer({
    eventBus,
    snapshotBuilder,
    priorityRouter,
    host: config.overlayHost,
    port: config.overlayPort
  });

  rlStatsApi.connect();

  logger.info(
    `Overlay WS running on ws://${config.overlayHost}:${config.overlayPort}`
  );
}

bootstrap().catch((err) => {
  logger.error("Fatal error", err);
  process.exit(1);
});
