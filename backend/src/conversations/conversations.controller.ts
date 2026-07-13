import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UserRole } from "../users/user-role.enum";
import { ConversationsService } from "./conversations.service";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { CreateDirectConversationDto } from "./dto/create-direct-conversation.dto";
import { CreateGroupConversationDto } from "./dto/create-group-conversation.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { FindConversationsQueryDto } from "./dto/find-conversations-query.dto";
import { FindMessagesQueryDto } from "./dto/find-messages-query.dto";
import { TransferGroupOwnerDto } from "./dto/transfer-group-owner.dto";
import { UpdateGroupConversationDto } from "./dto/update-group-conversation.dto";
import { UpdateMessageDto } from "./dto/update-message.dto";

@ApiTags("conversations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post("direct")
  @ApiCreatedResponse({
    description: "Direct conversation created or returned",
  })
  createDirectConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDirectConversationDto,
  ) {
    return this.conversationsService.createDirectConversation(user.id, dto);
  }

  @Post("groups")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @ApiCreatedResponse({ description: "Group conversation created" })
  createGroupConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupConversationDto,
  ) {
    return this.conversationsService.createGroupConversation(user.id, dto);
  }

  @Get()
  @ApiOkResponse({ description: "Current user's conversations" })
  findMyConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindConversationsQueryDto,
  ) {
    return this.conversationsService.findForUser(user.id, query);
  }

  @Get(":conversationId")
  @ApiOkResponse({ description: "Conversation detail" })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.findOneForUser(conversationId, user.id);
  }

  @Patch(":conversationId")
  @ApiOkResponse({ description: "Group conversation updated" })
  updateGroupConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: UpdateGroupConversationDto,
  ) {
    return this.conversationsService.updateGroupConversation(
      conversationId,
      user.id,
      user.role,
      dto,
    );
  }

  @Patch(":conversationId/owner")
  @ApiOkResponse({ description: "Group owner transferred" })
  transferGroupOwner(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: TransferGroupOwnerDto,
  ) {
    return this.conversationsService.transferGroupOwner(
      conversationId,
      user.id,
      user.role,
      dto,
    );
  }

  @Post(":conversationId/messages")
  @ApiCreatedResponse({ description: "Message created" })
  createMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.conversationsService.createMessage(
      conversationId,
      user.id,
      dto,
    );
  }

  @Get(":conversationId/messages")
  @ApiOkResponse({ description: "Conversation messages" })
  findMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Query() query: FindMessagesQueryDto,
  ) {
    return this.conversationsService.findMessages(
      conversationId,
      user.id,
      query,
    );
  }

  @Patch(":conversationId/messages/:messageId")
  @ApiOkResponse({ description: "Message updated" })
  updateMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.conversationsService.updateMessage(
      conversationId,
      messageId,
      user.id,
      dto,
    );
  }

  @Delete(":conversationId/messages/:messageId")
  @ApiOkResponse({ description: "Message deleted" })
  deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
  ) {
    return this.conversationsService.deleteMessage(
      conversationId,
      messageId,
      user.id,
    );
  }

  @Patch(":conversationId/read")
  @ApiOkResponse({ description: "Conversation marked as read" })
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.markAsRead(conversationId, user.id);
  }

  @Post(":conversationId/leave")
  @ApiOkResponse({ description: "Current user left the group conversation" })
  leaveConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.leaveConversation(conversationId, user.id);
  }

  @Get(":conversationId/participants")
  @ApiOkResponse({ description: "Conversation participants" })
  findParticipants(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.findParticipants(conversationId, user.id);
  }

  @Post(":conversationId/participants")
  @ApiCreatedResponse({ description: "Participant added" })
  addParticipant(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.conversationsService.addParticipant(
      conversationId,
      user.id,
      user.role,
      dto,
    );
  }

  @Delete(":conversationId/participants/:userId")
  @ApiOkResponse({ description: "Participant removed" })
  removeParticipant(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Param("userId") targetUserId: string,
  ) {
    return this.conversationsService.removeParticipant(
      conversationId,
      user.id,
      user.role,
      targetUserId,
    );
  }
}
