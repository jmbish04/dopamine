import { Logger } from "./logger";

export class ScopedLogger {
  constructor(private env: Env, private moduleName: string) {}
  async info(message: string, data?: any) {
    await Logger.info(message, this.env, { module: this.moduleName, event: "info", data });
  }
  async warn(message: string, data?: any) {
    await Logger.warn(message, this.env, { module: this.moduleName, event: "warn", data });
  }
  async error(message: string, data?: any) {
    await Logger.error(message, this.env, { module: this.moduleName, event: "error", error: data?.error, data });
  }
  async flush() {}
}
