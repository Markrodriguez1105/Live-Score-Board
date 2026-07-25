// ============================================================
// Pageant Management System — HTTP Request Logger Middleware
// ============================================================

import type { Request, Response, NextFunction } from "express";
import { createChildLogger } from "../logger.js";

const httpLogger = createChildLogger("HTTP");

function formatStatus(status: number): string {
  if (status >= 500) {
    return `\x1b[31m${status}\x1b[0m`; // Red
  }
  if (status >= 400) {
    return `\x1b[33m${status}\x1b[0m`; // Yellow
  }
  if (status >= 300) {
    return `\x1b[36m${status}\x1b[0m`; // Cyan
  }
  return `\x1b[32m${status}\x1b[0m`; // Green
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip verbose health checks or static uploads if desired, or log everything cleanly
  const startTime = performance.now();

  res.on("finish", () => {
    const duration = (performance.now() - startTime).toFixed(2);
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;

    const isProd = process.env.NODE_ENV === "production";

    if (isProd) {
      httpLogger.info({
        method,
        url,
        status,
        durationMs: parseFloat(duration),
        ip: req.ip || req.socket.remoteAddress,
      }, `${method} ${url} ${status} - ${duration}ms`);
    } else {
      const statusFormatted = formatStatus(status);
      httpLogger.info(`${method} ${url} ${statusFormatted} - \x1b[90m${duration}ms\x1b[0m`);
    }
  });

  next();
}
