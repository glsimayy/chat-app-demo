import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  ApiHeader,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { ConversationResponseDto } from "../common/swagger/backend-response.dto";
import { ConversationsService } from "../conversations/conversations.service";
import { BotSecretGuard } from "./bot-secret.guard";
import { CreateBotGroupDto } from "./dto/create-bot-group.dto";

@ApiTags("bot")
@Controller("bot")
@UseGuards(BotSecretGuard)
export class BotController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post(["groups", "create-group"])
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiHeader({
    name: "x-bot-secret",
    description: "Shared secret for Java/bot webhook calls",
  })
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Group conversation created by bot",
    status: 201,
  })
  @ApiUnauthorizedResponse({ description: "Bot secret is missing or invalid" })
  async createGroup(@Body() dto: CreateBotGroupDto) {
    return this.conversationsService.createExternalGroupConversation(
      dto.ownerId,
      {
        name: dto.name,
        participantIds: dto.participantIds,
      },
      dto.externalRef,
      dto.initialSystemMessage,
    );
  }
}
