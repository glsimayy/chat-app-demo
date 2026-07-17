import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { MetricsService } from "../../metrics/metrics.service";

type RequestWithId = Request & {
  requestId?: string;
};

const SENSITIVE_QUERY_PARAMETER =
  /(password|passcode|secret|token|authorization|api[-_]?key)/i;

export function sanitizeRequestPath(originalUrl: string) {
  try {
    const url = new URL(originalUrl, "http://localhost");

    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_PARAMETER.test(key)) {
        url.searchParams.set(key, "REDACTED");
      }
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return originalUrl.split("?", 1)[0] ?? "/";
  }
}

export function normalizeRequestId(header: string | string[] | undefined) {
  const candidate = Array.isArray(header) ? header[0] : header;

  if (candidate && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate)) {
    return candidate;
  }

  return crypto.randomUUID();
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  constructor(private readonly metricsService: MetricsService) {}

  use(request: RequestWithId, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestId = this.getRequestId(request);

    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    response.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const message = JSON.stringify({
        type: "http_request",
        requestId,
        method: request.method,
        path: sanitizeRequestPath(request.originalUrl),
        statusCode: response.statusCode,
        durationMs,
      });

      this.metricsService.recordHttpRequest(response.statusCode, durationMs);

      if (response.statusCode >= 500) {
        this.logger.error(message);
        return;
      }

      if (response.statusCode >= 400) {
        this.logger.warn(message);
        return;
      }

      this.logger.log(message);
    });

    next();
  }

  private getRequestId(request: Request) {
    return normalizeRequestId(request.headers["x-request-id"]);
  }
}
