import { Controller, ForbiddenException, Headers, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiHeader, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ConversationsService } from "../conversations/conversations.service";
import { UsersService } from "../users/users.service";

@ApiTags("dev")
@Controller("dev")
export class DevController {
  constructor(
    private readonly configService: ConfigService,
    private readonly conversationsService: ConversationsService,
    private readonly usersService: UsersService,
  ) {}

  @Post("reset")
  @ApiHeader({
    name: "x-dev-secret",
    description: "Development reset secret configured on the backend",
  })
  @ApiOkResponse({ description: "Development-only in-memory data reset" })
  resetInMemoryData(@Headers("x-dev-secret") providedSecret?: string) {
    if (this.configService.get<string>("NODE_ENV") === "production") {
      throw new ForbiddenException("Dev reset is disabled in production");
    }

    const expectedSecret = this.configService.get<string>("DEV_RESET_SECRET");

    if (!expectedSecret || providedSecret !== expectedSecret) {
      throw new ForbiddenException("Invalid or missing dev reset secret");
    }

    return {
      conversations: this.conversationsService.clearAll(),
      users: this.usersService.clearAll(),
    };
  }
}
