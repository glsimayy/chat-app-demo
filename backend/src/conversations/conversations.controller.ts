import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { FilesInterceptor } from "@nestjs/platform-express";
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
import {
  MAX_MESSAGE_ATTACHMENT_BYTES,
  MAX_MESSAGE_ATTACHMENTS,
} from "./attachment.config";
import { UploadedMessageFile } from "./conversation.types";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { CreateDirectConversationDto } from "./dto/create-direct-conversation.dto";
import { CreateGroupConversationDto } from "./dto/create-group-conversation.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { CreateMessageWithAttachmentsDto } from "./dto/create-message-with-attachments.dto";
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

  @Patch(":conversationId/bookmark")
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Conversation bookmark toggled for the current user",
  })
  toggleBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.toggleConversationBookmark(
      conversationId,
      user.id,
    );
  }

  @Patch(":conversationId/archive")
  @ApiSuccessResponse(ConversationResponseDto, {
    description: "Conversation archive state toggled for the current user",
  })
  toggleArchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.toggleConversationArchive(
      conversationId,
      user.id,
    );
  }

  @Delete(":conversationId")
  deleteConversationForCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.deleteConversationForUser(
      conversationId,
      user.id,
    );
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

  @Post(":conversationId/messages/attachments")
  @UseInterceptors(
    FilesInterceptor("files", MAX_MESSAGE_ATTACHMENTS, {
      limits: { fileSize: MAX_MESSAGE_ATTACHMENT_BYTES },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        content: { type: "string", maxLength: 2000 },
        clientMessageId: { type: "string", format: "uuid" },
        files: {
          type: "array",
          maxItems: MAX_MESSAGE_ATTACHMENTS,
          items: { type: "string", format: "binary" },
        },
      },
      required: ["files"],
    },
  })
  @ApiSuccessResponse(MessageResponseDto, {
    description: "Message with persistent attachments created",
    status: 201,
  })
  createMessageWithAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: CreateMessageWithAttachmentsDto,
    @UploadedFiles() files: UploadedMessageFile[] = [],
  ) {
    return this.conversationsService.createMessageWithAttachments(
      conversationId,
      user.id,
      dto,
      files,
    );
  }

  @Get(":conversationId/attachments/:attachmentId")
  @ApiProduces(
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/mp4",
  )
  @ApiOkResponse({
    description: "Attachment content",
    schema: { type: "string", format: "binary" },
  })
  async downloadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    const { attachment, data } = await this.conversationsService.getAttachment(
      conversationId,
      attachmentId,
      user.id,
    );
    const disposition = attachment.mimeType.startsWith("image/")
      ? "inline"
      : "attachment";
    const encodedFileName = encodeURIComponent(attachment.fileName).replace(
      /'/g,
      "%27",
    );

    return new StreamableFile(data, {
      type: attachment.mimeType,
      length: attachment.fileSize,
      disposition: `${disposition}; filename*=UTF-8''${encodedFileName}`,
    });
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
