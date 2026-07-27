import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import {
  BotGroupCreationResponseDto,
  ConversationParticipantResponseDto,
  ConversationResponseDto,
  MessageResponseDto,
} from "../common/swagger/backend-response.dto";
import { BotSecretGuard } from "./bot-secret.guard";
import { UpdateGroupConversationDto } from "../conversations/dto/update-group-conversation.dto";
import { UpdateMessageDto } from "../conversations/dto/update-message.dto";
import { UpdateParticipantRoleDto } from "../conversations/dto/update-participant-role.dto";
import { BotService } from "./bot.service";
import { AddBotGroupParticipantsDto } from "./dto/add-bot-group-participants.dto";
import { CreateBotGroupDto } from "./dto/create-bot-group.dto";
import { CreateBotMessageDto } from "./dto/create-bot-message.dto";

const createGroupExamples = {
  supportTicket: {
    summary: "Create an idempotent support group with built-in user IDs",
    value: {
      name: "Destek Talebi #4821",
      description: "Customer support coordination",
      participantIds: ["2", "4"],
      managerIds: ["1"],
      memberCanSendMessages: false,
      membersCanLeave: false,
      sourceName: "Support system",
      externalRef: "ticket-4821",
      initialBotMessage:
        "Support request received. An agent will join shortly.",
    },
  },
};

const updateGroupExamples = {
  close: {
    summary: "Close the group",
    value: { status: "closed" },
  },
  reopen: {
    summary: "Reopen the group",
    value: { status: "active" },
  },
  archive: {
    summary: "Archive the group",
    value: { status: "archived" },
  },
  settings: {
    summary: "Update the group name and member policies",
    value: {
      name: "Destek Talebi #4821 - Kritik",
      description: "Escalated customer support coordination",
      memberCanSendMessages: true,
      membersCanLeave: false,
    },
  },
};

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
  @ApiSuccessResponse(BotGroupCreationResponseDto, {
    description:
      "Automation group created or an existing externalRef group reused",
    status: 201,
  })
  @ApiBody({ type: CreateBotGroupDto, examples: createGroupExamples })
  async createGroup(@Body() dto: CreateBotGroupDto) {
    return this.botService.createGroup(dto);
  }

  @Post("create-group")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: "Legacy alias used by the Java ticket webhook",
  })
  @ApiSuccessResponse(BotGroupCreationResponseDto, {
    description:
      "Automation group created or an existing externalRef group reused",
    status: 201,
  })
  @ApiBody({ type: CreateBotGroupDto, examples: createGroupExamples })
  legacyCreateGroup(@Body() dto: CreateBotGroupDto) {
    return this.botService.createGroup(dto);
  }

  @Get("groups/:conversationId")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: "Get an automation group and its current settings" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Automation group detail",
  })
  findGroup(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ) {
    return this.botService.findGroup(conversationId);
  }

  @Get("groups/:conversationId/participants")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: "List active automation group participants" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiSuccessResponse(ConversationParticipantResponseDto, {
    description: "Active automation group participants",
    isArray: true,
  })
  findParticipants(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ) {
    return this.botService.findParticipants(conversationId);
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
  @ApiBody({
    type: AddBotGroupParticipantsDto,
    examples: {
      builtInUsers: {
        summary: "Add a member and a manager using built-in IDs",
        value: {
          participantIds: ["4", "6"],
          managerIds: ["5"],
        },
      },
    },
  })
  addParticipants(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() dto: AddBotGroupParticipantsDto,
  ) {
    return this.botService.addParticipants(conversationId, dto);
  }

  @Delete("groups/:conversationId/participants/:userId")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Remove a user from an automation group" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiParam({
    name: "userId",
    description: "User UUID or built-in automation ID",
    example: "4",
  })
  @ApiSuccessResponse(ConversationParticipantResponseDto, {
    description: "Active participants after the user is removed",
    isArray: true,
  })
  removeParticipant(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Param("userId") userId: string,
  ) {
    return this.botService.removeParticipant(conversationId, userId);
  }

  @Post("groups/:conversationId/messages")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: "Send a persistent realtime message as the bot" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiSuccessResponse(MessageResponseDto, {
    description: "Message sent by the automation bot",
    status: 201,
  })
  @ApiBody({
    type: CreateBotMessageDto,
    examples: {
      statusUpdate: {
        summary: "Send an idempotent realtime status message",
        value: {
          content: "Ticket priority changed to high.",
          clientMessageId: "3f0fe459-3816-4b83-b60a-5d195797f030",
        },
      },
    },
  })
  createMessage(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() dto: CreateBotMessageDto,
  ) {
    return this.botService.createMessage(conversationId, dto);
  }

  @Patch("groups/:conversationId/messages/:messageId")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Edit a message previously sent by the bot" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiParam({ name: "messageId", format: "uuid" })
  @ApiSuccessResponse(MessageResponseDto, {
    description: "Bot message updated and published in realtime",
  })
  @ApiBody({
    type: UpdateMessageDto,
    examples: {
      correction: {
        summary: "Correct a bot status message",
        value: { content: "Ticket priority changed to critical." },
      },
    },
  })
  updateMessage(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.botService.updateMessage(conversationId, messageId, dto);
  }

  @Delete("groups/:conversationId/messages/:messageId")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Delete a message previously sent by the bot" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiParam({ name: "messageId", format: "uuid" })
  @ApiSuccessResponse(MessageResponseDto, {
    description: "Bot message deleted and published in realtime",
  })
  deleteMessage(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
  ) {
    return this.botService.deleteMessage(conversationId, messageId);
  }

  @Patch("groups/:conversationId")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Update automation group settings" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Automation group updated",
  })
  @ApiBody({
    type: UpdateGroupConversationDto,
    examples: updateGroupExamples,
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
  @ApiParam({
    name: "userId",
    description: "User UUID or built-in automation ID",
    example: "1",
  })
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Automation group participant role updated",
  })
  @ApiBody({
    type: UpdateParticipantRoleDto,
    examples: {
      promote: {
        summary: "Promote a participant to manager",
        value: { role: "manager" },
      },
      demote: {
        summary: "Demote a manager to member",
        value: { role: "member" },
      },
    },
  })
  updateParticipantRole(
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Param("userId") userId: string,
    @Body() dto: UpdateParticipantRoleDto,
  ) {
    return this.botService.updateParticipantRole(conversationId, userId, dto);
  }
}
