import { EngineEvent } from "../types";

export class MatchCollector {
  private readonly recentEvents: EngineEvent[] = [];

  constructor(private readonly maxEvents = 50) {}

  collect(event: EngineEvent): void {
    this.recentEvents.unshift(event);
    this.recentEvents.splice(this.maxEvents);
  }

  listRecentEvents(): EngineEvent[] {
    return [...this.recentEvents];
  }
}
