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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import {
  ConversationListResponseDto,
  ConversationParticipantResponseDto,
  ConversationResponseDto,
  MessageListResponseDto,
  MessageResponseDto,
  MessageSearchResponseDto,
  ParticipantLeftResponseDto,
  ReadStateResponseDto,
} from "../common/swagger/backend-response.dto";
import { UserRole } from "../users/user-role.enum";
import { ConversationsService } from "./conversations.service";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { CreateDirectConversationDto } from "./dto/create-direct-conversation.dto";
import { CreateGroupConversationDto } from "./dto/create-group-conversation.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { FindConversationsQueryDto } from "./dto/find-conversations-query.dto";
import { FindMessagesQueryDto } from "./dto/find-messages-query.dto";
import { SearchMessagesQueryDto } from "./dto/search-messages-query.dto";
import { TransferGroupOwnerDto } from "./dto/transfer-group-owner.dto";
import { UpdateGroupConversationDto } from "./dto/update-group-conversation.dto";
import { UpdateMessageDto } from "./dto/update-message.dto";
import { UpdateParticipantRoleDto } from "./dto/update-participant-role.dto";

@ApiTags("conversations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post("direct")
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Direct conversation created or returned",
    status: 201,
  })
  createDirectConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDirectConversationDto,
  ) {
    return this.conversationsService.createDirectConversation(user.id, dto);
  }

  @Post("groups")
  @Roles(UserRole.Admin)
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Group conversation created",
    status: 201,
  })
  createGroupConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupConversationDto,
  ) {
    return this.conversationsService.createGroupConversation(user.id, dto);
  }

  @Get()
  @ApiSuccessResponse(ConversationListResponseDto, {
    description: "Current user's conversations",
  })
  findMyConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindConversationsQueryDto,
  ) {
    return this.conversationsService.findForUser(user.id, query);
  }

  @Get(":conversationId")
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Conversation detail",
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.findOneForUser(conversationId, user.id);
  }

  @Get(":conversationId/management")
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Private management conversation for authorized group roles",
  })
  findManagementConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.findManagementConversation(
      conversationId,
      user.id,
    );
  }

  @Patch(":conversationId")
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Group conversation updated",
  })
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
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Group owner transferred",
  })
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
  @ApiSuccessResponse(MessageResponseDto, {
    description: "Message created",
    status: 201,
  })
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
  @ApiSuccessResponse(MessageListResponseDto, {
    description: "Conversation messages",
  })
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

  @Get(":conversationId/messages/search")
  @ApiSuccessResponse(MessageSearchResponseDto, {
    description: "Search messages in conversation",
  })
  searchMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Query() query: SearchMessagesQueryDto,
  ) {
    return this.conversationsService.searchMessages(
      conversationId,
      user.id,
      query,
    );
  }

  @Patch(":conversationId/messages/:messageId")
  @ApiSuccessResponse(MessageResponseDto, {
    description: "Message updated",
  })
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
  @ApiSuccessResponse(MessageResponseDto, {
    description: "Message deleted",
  })
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
  @ApiSuccessResponse(ReadStateResponseDto, {
    description: "Conversation marked as read",
  })
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.markAsRead(conversationId, user.id);
  }

  @Post(":conversationId/leave")
  @ApiSuccessResponse(ParticipantLeftResponseDto, {
    description: "Current user left the group conversation",
  })
  leaveConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.leaveConversation(conversationId, user.id);
  }

  @Get(":conversationId/participants")
  @ApiSuccessResponse(ConversationParticipantResponseDto, {
    description: "Conversation participants",
    isArray: true,
  })
  findParticipants(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.findParticipants(conversationId, user.id);
  }

  @Post(":conversationId/participants")
  @ApiSuccessResponse(ConversationParticipantResponseDto, {
    description: "Participant added",
    status: 201,
  })
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
  @ApiSuccessResponse(ConversationParticipantResponseDto, {
    description: "Participant removed",
  })
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

  @Patch(":conversationId/participants/:userId/role")
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Participant group role updated",
  })
  updateParticipantRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Param("userId") targetUserId: string,
    @Body() dto: UpdateParticipantRoleDto,
  ) {
    return this.conversationsService.updateParticipantRole(
      conversationId,
      user.id,
      user.role,
      targetUserId,
      dto,
    );
  }
}
