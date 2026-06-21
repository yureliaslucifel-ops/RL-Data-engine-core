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
const snapshotBuilder = new SnapshotBuilder(stateEngine, sessionEngine);
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
    storageEngine.persistSnapshot(snapshotBuilder.buildFullSnapshot());
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
