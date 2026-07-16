import { Controller, ForbiddenException, Headers, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { DevResetResponseDto } from "../common/swagger/backend-response.dto";
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
  @ApiSuccessResponse(DevResetResponseDto, {
    description: "Development-only data reset",
  })
  async resetInMemoryData(@Headers("x-dev-secret") providedSecret?: string) {
    if (this.configService.get<string>("NODE_ENV") === "production") {
      throw new ForbiddenException("Dev reset is disabled in production");
    }

    const expectedSecret = this.configService.get<string>("DEV_RESET_SECRET");

    if (!expectedSecret || providedSecret !== expectedSecret) {
      throw new ForbiddenException("Invalid or missing dev reset secret");
    }

    const conversations = await this.conversationsService.clearAll();
    const users = await this.usersService.clearAll();

    return { conversations, users };
  }
}
