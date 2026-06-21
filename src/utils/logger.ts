export const logger = {
  info(message: string): void {
    console.log(`[RL DATA ENGINE] ${message}`);
  },

  error(message: string, error?: unknown): void {
    console.error(`[RL DATA ENGINE] ${message}`, error ?? "");
  }
};
