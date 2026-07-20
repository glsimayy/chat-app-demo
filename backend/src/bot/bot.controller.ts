import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import {
  ConversationParticipantResponseDto,
  ConversationResponseDto,
  MessageResponseDto,
} from "../common/swagger/backend-response.dto";
import { BotSecretGuard } from "./bot-secret.guard";
import { UpdateGroupConversationDto } from "../conversations/dto/update-group-conversation.dto";
import { UpdateParticipantRoleDto } from "../conversations/dto/update-participant-role.dto";
import { BotService } from "./bot.service";
import { AddBotGroupParticipantsDto } from "./dto/add-bot-group-participants.dto";
import { CreateBotGroupDto } from "./dto/create-bot-group.dto";
import { CreateBotMessageDto } from "./dto/create-bot-message.dto";

@ApiTags("bot")
@Controller("bot")
@UseGuards(BotSecretGuard)
@ApiHeader({
  name: "x-bot-secret",
  description: "Shared secret for trusted external automation calls",
})
@ApiUnauthorizedResponse({ description: "Bot secret is missing or invalid" })
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post("groups")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Create or return an idempotent automation group" })
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Group conversation created by bot",
    status: 201,
  })
  async createGroup(@Body() dto: CreateBotGroupDto) {
    return this.botService.createGroup(dto);
  }

  @Post("create-group")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: "Legacy alias used by the Java ticket webhook",
  })
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Group conversation created by bot",
    status: 201,
  })
  legacyCreateGroup(@Body() dto: CreateBotGroupDto) {
    return this.botService.createGroup(dto);
  }

  @Post("groups/:conversationId/participants")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Add users to an automation group" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiSuccessResponse(ConversationParticipantResponseDto, {
    description: "Active participants after the automation update",
    isArray: true,
    status: 201,
  })
  addParticipants(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() dto: AddBotGroupParticipantsDto,
  ) {
    return this.botService.addParticipants(conversationId, dto);
  }

  @Post("groups/:conversationId/messages")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: "Send a persistent realtime message as the bot" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiSuccessResponse(MessageResponseDto, {
    description: "Message sent by the automation bot",
    status: 201,
  })
  createMessage(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() dto: CreateBotMessageDto,
  ) {
    return this.botService.createMessage(conversationId, dto);
  }

  @Patch("groups/:conversationId")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Update automation group settings" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Automation group updated",
  })
  updateGroup(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() dto: UpdateGroupConversationDto,
  ) {
    return this.botService.updateGroup(conversationId, dto);
  }

  @Patch("groups/:conversationId/participants/:userId/role")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Promote or demote an automation group manager" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiParam({ name: "userId", format: "uuid" })
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Automation group participant role updated",
  })
  updateParticipantRole(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateParticipantRoleDto,
  ) {
    return this.botService.updateParticipantRole(conversationId, userId, dto);
  }
}
