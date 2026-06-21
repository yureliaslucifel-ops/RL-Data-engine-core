import { EventEmitter } from "events";
import { EngineEvent } from "../types";

export class EventBus {
  private readonly emitter = new EventEmitter();

  publish(event: EngineEvent): void {
    this.emitter.emit(event.type, event);
    this.emitter.emit("ANY", event);
  }

  on(eventType: string, listener: (event: EngineEvent) => void): void {
    this.emitter.on(eventType, listener);
  }
}
