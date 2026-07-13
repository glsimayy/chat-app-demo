import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ConversationsService } from "../conversations/conversations.service";
import { BotSecretGuard } from "./bot-secret.guard";
import { CreateBotGroupDto } from "./dto/create-bot-group.dto";

@ApiTags("bot")
@Controller("bot")
@UseGuards(BotSecretGuard)
export class BotController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post("groups")
  @ApiHeader({
    name: "x-bot-secret",
    description: "Shared secret for Java/bot webhook calls",
  })
  @ApiCreatedResponse({ description: "Group conversation created by bot" })
  @ApiUnauthorizedResponse({ description: "Bot secret is missing or invalid" })
  async createGroup(@Body() dto: CreateBotGroupDto) {
    const conversation =
      await this.conversationsService.createGroupConversation(dto.ownerId, {
        name: dto.name,
        participantIds: dto.participantIds,
      });

    conversation.externalRef = dto.externalRef ?? null;

    if (dto.initialSystemMessage?.trim()) {
      this.conversationsService.addSystemEvent(
        conversation.id,
        dto.initialSystemMessage,
      );
    }

    return conversation;
  }
}
