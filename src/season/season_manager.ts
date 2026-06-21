export interface Season {
  seasonId: string;
  seasonName?: string;
  start?: number;
  end?: number;
}

export class SeasonManager {
  private season: Season | null = null;
  private path: string;

  constructor(path = "config/season.json") {
    this.path = path;
    // attempt to load from env
    const seasonId = process.env.SEASON_ID;
    const seasonName = process.env.SEASON_NAME;
    const start = process.env.SEASON_START ? Number(process.env.SEASON_START) : undefined;
    const end = process.env.SEASON_END ? Number(process.env.SEASON_END) : undefined;

    if (seasonId) {
      this.season = {
        seasonId,
        seasonName,
        start,
        end
      };
    }
  }

  getCurrentSeason(): Season | null {
    return this.season;
  }

  setSeason(season: Season): void {
    this.season = season;
    // persist to file (best effort)
    import("fs/promises").then(async (fs) => {
      try {
        await fs.mkdir(require("path").dirname(this.path), { recursive: true });
        await fs.writeFile(this.path, JSON.stringify(season, null, 2), "utf-8");
      } catch {
        // ignore write errors
      }
    });
  }

  clearSeason(): void {
    this.season = null;
  }
}
