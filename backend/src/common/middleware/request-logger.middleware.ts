import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { MetricsService } from "../../metrics/metrics.service";

type RequestWithId = Request & {
  requestId?: string;
};

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
        path: request.originalUrl,
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
    const header = request.headers["x-request-id"];

    if (Array.isArray(header)) {
      return header[0] ?? crypto.randomUUID();
    }

    return header ?? crypto.randomUUID();
  }
}
