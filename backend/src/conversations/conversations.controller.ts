import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  findMyConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.findForUser(user.id);
  }

  @Get(":conversationId")
  @ApiOkResponse({ description: "Conversation detail" })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.findOneForUser(conversationId, user.id);
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
  ) {
    return this.conversationsService.findMessages(conversationId, user.id);
  }

  @Patch(":conversationId/read")
  @ApiOkResponse({ description: "Conversation marked as read" })
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.conversationsService.markAsRead(conversationId, user.id);
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
