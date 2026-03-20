import { getDb } from "@/db";
import { systemLogs, type LogLevel } from "@/db/schema/system_logs";

type LogContext = {
  module: string;
  event: string;
  request?: Request;
  requestId?: string;
  data?: unknown;
  error?: unknown;
  source?: "worker" | "python";
};

type Trace = {
  file: string;
  func: string;
  line: number;
  stack: string | null;
};

const createRequestId = (request?: Request, requestId?: string) =>
  requestId ?? request?.headers.get("cf-ray") ?? crypto.randomUUID();

const serialize = (value: unknown) => {
  if (value === undefined) {
    return null;
  }

  if (value instanceof Error) {
    return JSON.stringify({
      name: value.name,
      message: value.message,
      stack: value.stack,
    });
  }

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ value: String(value) });
  }
};

const extractTrace = (): Trace => {
  const stackLines = new Error().stack?.split("\n").slice(3) ?? [];
  const stackLine = stackLines[0] ?? "";
  const match =
    stackLine.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/) ??
    stackLine.match(/at\s+(.+):(\d+):(\d+)/);

  if (!match) {
    return {
      file: "unknown",
      func: "unknown",
      line: 0,
      stack: stackLines.join("\n") || null,
    };
  }

  if (match.length === 5) {
    return {
      func: match[1] ?? "unknown",
      file: match[2] ?? "unknown",
      line: Number(match[3] ?? 0),
      stack: stackLines.join("\n") || null,
    };
  }

  return {
    func: "unknown",
    file: match[1] ?? "unknown",
    line: Number(match[2] ?? 0),
    stack: stackLines.join("\n") || null,
  };
};

const getConsoleMethod = (level: LogLevel) => {
  if (level === "ERROR") {
    return console.error;
  }

  if (level === "WARN") {
    return console.warn;
  }

  return console.log;
};

export class Logger {
  static async log(level: LogLevel, message: string, env: Env, context: LogContext) {
    const trace = extractTrace();
    const requestId = createRequestId(context.request, context.requestId);
    const url = context.request ? new URL(context.request.url) : null;
    const method = context.request?.method ?? null;
    const path = url?.pathname ?? null;
    const timestamp = new Date().toISOString();
    const errorPayload =
      context.error instanceof Error
        ? {
            name: context.error.name,
            message: context.error.message,
            stack: context.error.stack,
          }
        : context.error ?? null;

    const consoleRecord = {
      timestamp,
      requestId,
      level,
      module: context.module,
      event: context.event,
      message,
      method,
      path,
      trace,
      data: context.data ?? null,
      error: errorPayload,
      source: context.source ?? "worker",
    };

    getConsoleMethod(level)(JSON.stringify(consoleRecord));

    try {
      await getDb(env)
        .insert(systemLogs)
        .values({
          requestId,
          level,
          module: context.module,
          event: context.event,
          message,
          file: trace.file,
          func: trace.func,
          line: trace.line,
          method,
          path,
          stack: trace.stack,
          data: serialize({
            data: context.data ?? null,
            error: errorPayload,
          }),
          source: context.source ?? "worker",
          createdAt: Date.now(),
        })
        .run();
    } catch (persistError) {
      console.error(
        JSON.stringify({
          timestamp,
          requestId,
          level: "ERROR",
          module: "logging",
          event: "persist_failed",
          message: "Failed to mirror log entry to D1",
          error:
            persistError instanceof Error
              ? {
                  name: persistError.name,
                  message: persistError.message,
                  stack: persistError.stack,
                }
              : persistError,
        }),
      );
    }
  }

  static info(message: string, env: Env, context: LogContext) {
    return this.log("INFO", message, env, context);
  }

  static warn(message: string, env: Env, context: LogContext) {
    return this.log("WARN", message, env, context);
  }

  static error(message: string, env: Env, context: LogContext) {
    return this.log("ERROR", message, env, context);
  }
}
