// ============================================================
// Pageant Management System — Logger Module
// ============================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

function getMinLogLevel(): number {
  const envLevel = (process.env.LOG_LEVEL || "").toLowerCase() as LogLevel;
  if (envLevel in LOG_LEVELS) {
    return LOG_LEVELS[envLevel];
  }
  return process.env.NODE_ENV === "production" ? LOG_LEVELS.info : LOG_LEVELS.debug;
}

function formatTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const padMs = (n: number) => n.toString().padStart(3, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${padMs(d.getMilliseconds())}`;
  return time;
}

function formatLevelBadge(level: LogLevel): string {
  switch (level) {
    case "debug":
      return `${ANSI.magenta}[DEBUG]${ANSI.reset}`;
    case "info":
      return `${ANSI.green}[INFO ]${ANSI.reset}`;
    case "warn":
      return `${ANSI.yellow}[WARN ]${ANSI.reset}`;
    case "error":
      return `${ANSI.red}[ERROR]${ANSI.reset}`;
  }
}

export interface LoggerOptions {
  tag?: string;
  defaultMeta?: Record<string, unknown>;
}

export class Logger {
  private tag?: string;
  private defaultMeta?: Record<string, unknown>;

  constructor(options: LoggerOptions = {}) {
    this.tag = options.tag;
    this.defaultMeta = options.defaultMeta;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= getMinLogLevel();
  }

  private log(level: LogLevel, messageOrMeta: unknown, msgOrMeta?: unknown, ...args: unknown[]) {
    if (!this.shouldLog(level)) return;

    let message = "";
    let meta: Record<string, unknown> | undefined = this.defaultMeta ? { ...this.defaultMeta } : undefined;

    if (typeof messageOrMeta === "string") {
      message = messageOrMeta;
      if (typeof msgOrMeta === "object" && msgOrMeta !== null) {
        meta = { ...meta, ...(msgOrMeta as Record<string, unknown>) };
      }
    } else if (messageOrMeta instanceof Error) {
      const err = messageOrMeta;
      meta = { ...meta, error: err.stack || err.message };

      if (typeof msgOrMeta === "string") {
        message = err.message ? `${msgOrMeta}: ${err.message}` : msgOrMeta;
        if (args[0] && typeof args[0] === "object" && args[0] !== null) {
          meta = { ...meta, ...(args[0] as Record<string, unknown>) };
        }
      } else if (typeof msgOrMeta === "object" && msgOrMeta !== null) {
        meta = { ...meta, ...(msgOrMeta as Record<string, unknown>) };
        message = err.message;
      } else {
        message = err.message;
      }
    } else if (typeof messageOrMeta === "object" && messageOrMeta !== null) {
      meta = { ...meta, ...(messageOrMeta as Record<string, unknown>) };
      if (typeof msgOrMeta === "string") {
        message = msgOrMeta;
      } else {
        message = "";
      }
    } else {
      message = String(messageOrMeta);
    }

    if (args.length > 0 && !(messageOrMeta instanceof Error && typeof msgOrMeta === "string" && typeof args[0] === "object")) {
      if (meta) {
        meta.extraArgs = args;
      } else {
        meta = { extraArgs: args };
      }
    }

    const tagToUse = (meta?.tag as string) || this.tag;
    if (meta && "tag" in meta && meta.tag === tagToUse) {
      const { tag: _, ...rest } = meta;
      meta = Object.keys(rest).length > 0 ? rest : undefined;
    }

    const isProd = process.env.NODE_ENV === "production";

    if (isProd) {
      const payload = {
        timestamp: new Date().toISOString(),
        level,
        ...(tagToUse ? { tag: tagToUse } : {}),
        message,
        ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
      };
      const jsonStr = JSON.stringify(payload);
      if (level === "error") {
        process.stderr.write(jsonStr + "\n");
      } else {
        process.stdout.write(jsonStr + "\n");
      }
    } else {
      const timestamp = `${ANSI.gray}${formatTimestamp()}${ANSI.reset}`;
      const levelBadge = formatLevelBadge(level);
      const tagBadge = tagToUse ? `${ANSI.bold}${ANSI.cyan}[${tagToUse}]${ANSI.reset} ` : "";
      
      let formattedMeta = "";
      if (meta && Object.keys(meta).length > 0) {
        if (meta.error && typeof meta.error === "string") {
          formattedMeta = `\n${ANSI.red}${meta.error}${ANSI.reset}`;
        } else {
          formattedMeta = ` ${ANSI.gray}${JSON.stringify(meta)}${ANSI.reset}`;
        }
      }

      const output = `${timestamp} ${levelBadge} ${tagBadge}${message}${formattedMeta}\n`;
      if (level === "error") {
        process.stderr.write(output);
      } else {
        process.stdout.write(output);
      }
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void;
  debug(error: Error, message?: string, meta?: Record<string, unknown>): void;
  debug(error: Error, meta?: Record<string, unknown>): void;
  debug(meta: Record<string, unknown>, message?: string): void;
  debug(messageOrMeta: unknown, msgOrMeta?: unknown, ...args: unknown[]): void {
    this.log("debug", messageOrMeta, msgOrMeta, ...args);
  }

  info(message: string, meta?: Record<string, unknown>): void;
  info(error: Error, message?: string, meta?: Record<string, unknown>): void;
  info(error: Error, meta?: Record<string, unknown>): void;
  info(meta: Record<string, unknown>, message?: string): void;
  info(messageOrMeta: unknown, msgOrMeta?: unknown, ...args: unknown[]): void {
    this.log("info", messageOrMeta, msgOrMeta, ...args);
  }

  warn(message: string, meta?: Record<string, unknown>): void;
  warn(error: Error, message?: string, meta?: Record<string, unknown>): void;
  warn(error: Error, meta?: Record<string, unknown>): void;
  warn(meta: Record<string, unknown>, message?: string): void;
  warn(messageOrMeta: unknown, msgOrMeta?: unknown, ...args: unknown[]): void {
    this.log("warn", messageOrMeta, msgOrMeta, ...args);
  }

  error(message: string, meta?: Record<string, unknown>): void;
  error(error: Error, message?: string, meta?: Record<string, unknown>): void;
  error(error: Error, meta?: Record<string, unknown>): void;
  error(meta: Record<string, unknown>, message?: string): void;
  error(messageOrMeta: unknown, msgOrMeta?: unknown, ...args: unknown[]): void {
    this.log("error", messageOrMeta, msgOrMeta, ...args);
  }

  child(options: LoggerOptions | string): Logger {
    const opts = typeof options === "string" ? { tag: options } : options;
    return new Logger({
      tag: opts.tag || this.tag,
      defaultMeta: { ...this.defaultMeta, ...opts.defaultMeta },
    });
  }
}

export const logger = new Logger();

export function createChildLogger(tag: string, defaultMeta?: Record<string, unknown>): Logger {
  return logger.child({ tag, defaultMeta });
}
