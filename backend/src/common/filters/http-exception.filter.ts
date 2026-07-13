import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";

interface ErrorResponseBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body =
      typeof exceptionResponse === "object" && exceptionResponse !== null
        ? (exceptionResponse as ErrorResponseBody)
        : undefined;

    response.status(status).json({
      success: false,
      statusCode: status,
      message:
        body?.message ??
        (typeof exceptionResponse === "string"
          ? exceptionResponse
          : "Internal server error"),
      error: body?.error ?? HttpStatus[status] ?? "Error",
      timestamp: new Date().toISOString(),
    });
  }
}
