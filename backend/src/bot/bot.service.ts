import { Injectable } from "@nestjs/common";
import { ConversationsService } from "../conversations/conversations.service";
import { UsersService } from "../users/users.service";
import { UpdateGroupConversationDto } from "../conversations/dto/update-group-conversation.dto";
import { UpdateParticipantRoleDto } from "../conversations/dto/update-participant-role.dto";
import { AddBotGroupParticipantsDto } from "./dto/add-bot-group-participants.dto";
import { CreateBotGroupDto } from "./dto/create-bot-group.dto";
import { CreateBotMessageDto } from "./dto/create-bot-message.dto";

@Injectable()
export class BotService {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly usersService: UsersService,
  ) {}

  async createGroup(dto: CreateBotGroupDto) {
    const bot = await this.usersService.ensureAutomationBot();
    const managerIds = Array.from(
      new Set([
        ...(dto.managerIds ?? []),
        ...(dto.ownerId ? [dto.ownerId] : []),
      ]),
    );
    const participantIds = Array.from(
      new Set([...dto.participantIds, ...managerIds, bot.id]),
    );

    return this.conversationsService.createExternalGroupConversation(
      bot.id,
      {
        name: dto.name,
        description: dto.description,
        participantIds,
        managerIds,
        memberCanSendMessages: dto.memberCanSendMessages ?? false,
        membersCanLeave: dto.membersCanLeave ?? false,
      },
      dto.externalRef,
      dto.initialBotMessage ?? dto.initialSystemMessage,
      dto.sourceName,
    );
  }

  async addParticipants(
    conversationId: string,
    dto: AddBotGroupParticipantsDto,
  ) {
    const bot = await this.usersService.ensureAutomationBot();

    return this.conversationsService.addExternalParticipants(
      conversationId,
      bot.id,
      dto.participantIds,
      dto.managerIds,
    );
  }

  async createMessage(conversationId: string, dto: CreateBotMessageDto) {
    const bot = await this.usersService.ensureAutomationBot();

    return this.conversationsService.createExternalMessage(
      conversationId,
      bot.id,
      dto,
    );
  }

  async updateGroup(conversationId: string, dto: UpdateGroupConversationDto) {
    const bot = await this.usersService.ensureAutomationBot();
    return this.conversationsService.updateExternalGroup(
      conversationId,
      bot.id,
      dto,
    );
  }

  async updateParticipantRole(
    conversationId: string,
    userId: string,
    dto: UpdateParticipantRoleDto,
  ) {
    const bot = await this.usersService.ensureAutomationBot();
    return this.conversationsService.updateExternalParticipantRole(
      conversationId,
      bot.id,
      userId,
      dto,
    );
  }
}
