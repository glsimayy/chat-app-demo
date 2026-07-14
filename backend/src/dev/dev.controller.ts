import { ForbiddenException, Post, Controller } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
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
  @ApiOkResponse({ description: "Development-only in-memory data reset" })
  resetInMemoryData() {
    if (this.configService.get<string>("NODE_ENV") === "production") {
      throw new ForbiddenException("Dev reset is disabled in production");
    }

    return {
      conversations: this.conversationsService.clearAll(),
      users: this.usersService.clearAll(),
    };
  }
}
