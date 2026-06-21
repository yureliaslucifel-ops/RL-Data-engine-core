import { OverlaySnapshot } from "../types";
import { SessionEngine } from "../session/session_engine";
import { StateEngine } from "../state/state_engine";

export class SnapshotBuilder {
  constructor(
    private readonly stateEngine: StateEngine,
    private readonly sessionEngine: SessionEngine
  ) {}

  buildFullSnapshot(): OverlaySnapshot {
    return {
      type: "snapshot",
      timestamp: Date.now(),
      state: this.stateEngine.getSnapshot(),
      session: this.sessionEngine.getSnapshot()
    };
  }

  build(): OverlaySnapshot {
    return this.buildFullSnapshot();
  }
}
