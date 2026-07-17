import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  WsExceptionFilter,
} from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { MetricsService } from "../metrics/metrics.service";

interface ErrorBody {
  code?: string;
  error?: string;
  errors?: unknown;
  event?: string;
  message?: string | string[];
  retryAfterMs?: number;
}

@Catch()
export class SocketExceptionFilter implements WsExceptionFilter {
  private readonly logger = new Logger(SocketExceptionFilter.name);

  constructor(private readonly metricsService: MetricsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    this.metricsService.recordSocketError();
    const client = host.switchToWs().getClient<Socket>();
    const response = this.normalize(exception);
    const payload = {
      success: false,
      ...response,
      timestamp: new Date().toISOString(),
    };
    const ack = host
      .getArgs()
      .find((argument) => typeof argument === "function") as
      ((response: unknown) => void) | undefined;

    if (ack) {
      ack(payload);
      return;
    }

    client.emit("exception", payload);
  }

  private normalize(exception: unknown) {
    if (exception instanceof WsException) {
      const error = exception.getError();

      if (typeof error === "string") {
        return { code: "BAD_REQUEST", message: error };
      }

      const body = error as ErrorBody;
      return {
        code: body.code ?? "BAD_REQUEST",
        message: this.normalizeMessage(body.message),
        ...(body.errors === undefined ? {} : { errors: body.errors }),
        ...(body.event === undefined ? {} : { event: body.event }),
        ...(body.retryAfterMs === undefined
          ? {}
          : { retryAfterMs: body.retryAfterMs }),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const rawResponse = exception.getResponse();
      const body =
        typeof rawResponse === "object" && rawResponse !== null
          ? (rawResponse as ErrorBody)
          : undefined;

      return {
        code: this.statusCodeToErrorCode(status),
        message: this.normalizeMessage(
          body?.message ??
            (typeof rawResponse === "string" ? rawResponse : undefined),
        ),
      };
    }

    this.logger.error(
      JSON.stringify({
        type: "socket_unhandled_exception",
        errorName: exception instanceof Error ? exception.name : "UnknownError",
      }),
    );

    return {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    };
  }

  private normalizeMessage(message?: string | string[]) {
    if (Array.isArray(message)) {
      return message.join(", ");
    }

    return message ?? "Socket request failed";
  }

  private statusCodeToErrorCode(status: number) {
    const codes: Partial<Record<number, string>> = {
      [HttpStatus.BAD_REQUEST]: "BAD_REQUEST",
      [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
      [HttpStatus.FORBIDDEN]: "FORBIDDEN",
      [HttpStatus.NOT_FOUND]: "NOT_FOUND",
      [HttpStatus.CONFLICT]: "CONFLICT",
      [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMITED",
    };

    return codes[status] ?? "INTERNAL_ERROR";
  }
}
