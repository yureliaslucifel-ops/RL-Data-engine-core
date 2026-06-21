export interface AppConfig {
  rlStatsHost: string;
  rlStatsPort: number;
  overlayHost: string;
  overlayPort: number;
  databasePath: string;
}

export function loadConfig(): AppConfig {
  return {
    rlStatsHost: process.env.RL_STATS_HOST ?? "127.0.0.1",
    rlStatsPort: readPort("RL_STATS_PORT", 49123),
    overlayHost: process.env.OVERLAY_HOST ?? "0.0.0.0",
    overlayPort: readPort("OVERLAY_PORT", 8080),
    databasePath: process.env.DATABASE_PATH ?? "data/rl-data-engine.sqlite"
  };
}

function readPort(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
