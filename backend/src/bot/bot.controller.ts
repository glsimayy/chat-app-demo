import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
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
  @ApiCreatedResponse({ description: "Group conversation created by bot" })
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
