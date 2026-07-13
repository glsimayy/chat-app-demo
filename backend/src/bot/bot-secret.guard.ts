import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

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

    if (!configuredSecret || receivedSecret !== configuredSecret) {
      throw new UnauthorizedException("Invalid bot secret");
    }

    return true;
  }
}
