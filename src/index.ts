import { RLStatsAPI } from "./api/rl_stats_api";
import { MatchCollector } from "./collectors/match_collector";
import { loadConfig } from "./config";
import { EventBus } from "./core/event_bus";
import { PriorityRouter } from "./core/priority_router";
import { SessionEngine } from "./session/session_engine";
import { StateEngine } from "./state/state_engine";
import { StorageEngine } from "./storage/storage_engine";
import { SQLiteStorage } from "./storage/sqlite/sqlite_storage";
import { SnapshotBuilder } from "./websocket/snapshot_builder";
import { startWebSocketServer } from "./websocket/ws_server";
import { logger } from "./utils/logger";
import { SeasonManager } from "./season/season_manager";
import { accountManager } from "./accounts/account_manager";
import { AccountStats } from "./types";

const config = loadConfig();

const rlStatsApi = new RLStatsAPI({
  host: config.rlStatsHost,
  port: config.rlStatsPort
});

const eventBus = new EventBus();
const stateEngine = new StateEngine();
const sessionEngine = new SessionEngine();
const matchCollector = new MatchCollector();
const priorityRouter = new PriorityRouter();
const seasonManager = new SeasonManager();
const snapshotBuilder = new SnapshotBuilder(stateEngine, sessionEngine, seasonManager);
const storageEngine = new StorageEngine(new SQLiteStorage(config.databasePath));

rlStatsApi.on("connect", ({ url }) => {
  stateEngine.setRocketLeagueConnection(true);
  logger.info(`Connected to Rocket League Stats API at ${url}`);
});

rlStatsApi.on("disconnect", () => {
  stateEngine.setRocketLeagueConnection(false);
  logger.info("Disconnected from Rocket League Stats API. Waiting for reconnect...");
});

rlStatsApi.on("error", (error) => {
  logger.error("Rocket League Stats API error", error);
});

rlStatsApi.on("event", (event) => {
  const routed = priorityRouter.route(event);

  if (routed.targets.collector) {
    matchCollector.collect(routed.event);
  }

  if (routed.targets.state) {
    stateEngine.update(routed.event);
  }

  if (routed.targets.session) {
    sessionEngine.process(routed.event);
  }

  if (routed.priority === "high" || routed.priority === "session") {
    storageEngine.persistEvent(routed.event, routed.priority);
  }

  if (routed.event.type === "MatchEnded" || routed.event.type === "MatchDestroyed") {
    const snapshot = snapshotBuilder.buildFullSnapshot();

    // determine winning team
    let winningTeamNum: number | undefined;
    const scoreMap = snapshot.matchStats?.score;
    if (scoreMap) {
      const entries = Object.entries(scoreMap).map(([k, v]) => ({ teamNum: Number(k), score: v }));
      entries.sort((a, b) => b.score - a.score);
      if (entries.length > 0) {
        winningTeamNum = entries[0].teamNum;
      }
    }

    // compute MVP(s): highest score within winning team
    const players = snapshot.matchStats?.players || [];
    const winningPlayers = typeof winningTeamNum === "number" ? players.filter((p) => p.teamNum === winningTeamNum) : [];
    let maxScore = Number.NEGATIVE_INFINITY;
    for (const p of winningPlayers) {
      if (typeof p.score === "number" && p.score > maxScore) {
        maxScore = p.score;
      }
    }

    const deltas: AccountStats[] = [];

    for (const p of players) {
      // map player to account
      const entry = p.primaryId ? accountManager.findByPrimaryId(p.primaryId) : accountManager.list().find((e: any) => e.name === p.name || e.displayName === p.name);
      if (!entry) continue;

      const isMvp = typeof maxScore === "number" && p.teamNum === winningTeamNum && p.score === maxScore;

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
      // StorageEngine type in this codebase may not declare updateAccountStats on all variants; cast to any to avoid TS build errors
      (storageEngine as any).updateAccountStats(deltas, seasonId);
    }

    storageEngine.persistSnapshot(snapshot);
  }

  if (routed.targets.broadcast) {
    eventBus.publish(routed.event);
  }
});

async function bootstrap(): Promise<void> {
  try {
    await storageEngine.init();
    logger.info(`Storage database ready at ${config.databasePath}`);
  } catch (error) {
    logger.error("Storage disabled because SQLite failed to initialize", error);
  }

  startWebSocketServer({
    eventBus,
    snapshotBuilder,
    priorityRouter,
    host: config.overlayHost,
    port: config.overlayPort
  });

  rlStatsApi.connect();

  logger.info(`Overlay WebSocket listening on ws://${config.overlayHost}:${config.overlayPort}`);
}

bootstrap().catch((error) => {
  logger.error("Failed to start RL Data Engine", error);
  process.exit(1);
});
