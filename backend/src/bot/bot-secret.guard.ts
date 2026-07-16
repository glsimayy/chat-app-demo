import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { timingSafeEqual } from "node:crypto";

@Injectable()
export class BotSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const configuredSecret = this.configService.get<string>(
      "BOT_WEBHOOK_SECRET",
      "",
    );
    const rawHeader = request.headers["x-bot-secret"];
    const receivedSecret = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (
      !configuredSecret ||
      !this.secretsMatch(configuredSecret, receivedSecret)
    ) {
      throw new UnauthorizedException("Invalid bot secret");
    }

    return true;
  }

  private secretsMatch(expected: string, received?: string) {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received ?? "");
    const sameLength = expectedBuffer.length === receivedBuffer.length;
    const comparableBuffer = sameLength
      ? receivedBuffer
      : Buffer.alloc(expectedBuffer.length);
    const matches = timingSafeEqual(expectedBuffer, comparableBuffer);

    return sameLength && matches;
  }
}
