import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../users/user-role.enum";
import { ConversationType } from "../../conversations/conversation-type.enum";
import { MessageType } from "../../conversations/message-type.enum";
import { ParticipantRole } from "../../conversations/participant-role.enum";
import { ConversationStatus } from "../../conversations/conversation-status.enum";
import { SupportTicketPriority } from "../../tickets/support-ticket-priority.enum";
import { SupportTicketStatus } from "../../tickets/support-ticket-status.enum";
import { SupportTicketActivityAction } from "../../tickets/support-ticket-activity-action.enum";
import { ContactInvitationStatus } from "../../contact-invitations/contact-invitation-status.enum";

export class UserResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Short user reference accepted by the bot API",
    example: 1,
  })
  automationId!: number | null;

  @ApiProperty({ example: "emir" })
  username!: string;

  @ApiProperty({ example: "emir@example.com" })
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiPropertyOptional({ nullable: true })
  about!: string | null;

  @ApiPropertyOptional({ nullable: true })
  location!: string | null;

  @ApiPropertyOptional({ nullable: true })
  profileImage!: string | null;

  @ApiProperty({ description: "Whether this account is an automation bot" })
  isBot!: boolean;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;
}

export class ContactInvitationResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  senderId!: string;

  @ApiProperty({ format: "uuid" })
  recipientId!: string;

  @ApiPropertyOptional({ nullable: true })
  message!: string | null;

  @ApiProperty({ enum: ContactInvitationStatus })
  status!: ContactInvitationStatus;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  respondedAt!: string | null;

  @ApiProperty({ type: UserResponseDto })
  sender!: UserResponseDto;

  @ApiProperty({ type: UserResponseDto })
  recipient!: UserResponseDto;
}

export class ContactInvitationActionResponseDto {
  @ApiProperty({ type: ContactInvitationResponseDto })
  invitation!: ContactInvitationResponseDto;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  conversationId!: string | null;
}

export class AuthResponseDto {
  @ApiProperty({ description: "JWT access token" })
  accessToken!: string;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}

export class PasswordChangedResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({ format: "date-time" })
  changedAt!: string;
}

export class ConversationParticipantResponseDto {
  @ApiProperty({ format: "uuid" })
  userId!: string;

  @ApiProperty({ enum: ParticipantRole })
  role!: ParticipantRole;

  @ApiProperty({ format: "date-time" })
  joinedAt!: string;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  lastReadAt!: string | null;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  leftAt!: string | null;
}

export class MessageAttachmentResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ example: "release-screenshot.png" })
  fileName!: string;

  @ApiProperty({ example: "image/png" })
  mimeType!: string;

  @ApiProperty({ example: 245760 })
  fileSize!: number;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;
}

export class MessageReplyResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  conversationId!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  senderId!: string | null;

  @ApiProperty({ example: "Toplanti saat 14.00'te." })
  content!: string;

  @ApiProperty({ enum: MessageType })
  messageType!: MessageType;

  @ApiProperty({ default: false })
  isForwarded!: boolean;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  deletedAt!: string | null;

  @ApiProperty({ type: [MessageAttachmentResponseDto] })
  attachments!: MessageAttachmentResponseDto[];
}

export class MessageResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  clientMessageId!: string | null;

  @ApiProperty({ format: "uuid" })
  conversationId!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  senderId!: string | null;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  replyToMessageId!: string | null;

  @ApiPropertyOptional({ type: MessageReplyResponseDto, nullable: true })
  replyTo!: MessageReplyResponseDto | null;

  @ApiProperty({ example: "Selam, nasilsin?" })
  content!: string;

  @ApiProperty({ enum: MessageType })
  messageType!: MessageType;

  @ApiProperty({ default: false })
  isForwarded!: boolean;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  updatedAt!: string | null;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  deletedAt!: string | null;

  @ApiProperty({ type: [MessageAttachmentResponseDto] })
  attachments!: MessageAttachmentResponseDto[];
}

export class MessageBookmarkConversationResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ConversationType })
  type!: ConversationType;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  parentConversationId!: string | null;
}

export class MessageBookmarkResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  userId!: string;

  @ApiProperty({ format: "uuid" })
  messageId!: string;

  @ApiPropertyOptional({ nullable: true })
  title!: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;

  @ApiProperty({ type: MessageResponseDto })
  message!: MessageResponseDto;

  @ApiProperty({ type: MessageBookmarkConversationResponseDto })
  conversation!: MessageBookmarkConversationResponseDto;

  @ApiPropertyOptional({ type: UserResponseDto, nullable: true })
  sender!: UserResponseDto | null;
}

export class ConversationResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ConversationType })
  type!: ConversationType;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ format: "uuid" })
  createdBy!: string;

  @ApiPropertyOptional({ nullable: true })
  externalRef!: string | null;

  @ApiProperty()
  isBotManaged!: boolean;

  @ApiPropertyOptional({ nullable: true })
  sourceName!: string | null;

  @ApiProperty()
  memberCanSendMessages!: boolean;

  @ApiProperty()
  membersCanLeave!: boolean;

  @ApiProperty({ enum: ConversationStatus })
  status!: ConversationStatus;

  @ApiProperty({ default: false })
  isBookmarked!: boolean;

  @ApiProperty({ default: false })
  isArchived!: boolean;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  parentConversationId!: string | null;

  @ApiProperty({ type: [ConversationParticipantResponseDto] })
  participants!: ConversationParticipantResponseDto[];

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;
}

export class BotGroupCreationResponseDto extends ConversationResponseDto {
  @ApiProperty({
    description: "True when this request created the automation group",
  })
  created!: boolean;

  @ApiProperty({
    description:
      "True when an existing group was returned for the supplied externalRef",
  })
  reused!: boolean;
}

export class ConversationSummaryResponseDto extends ConversationResponseDto {
  @ApiProperty()
  participantCount!: number;

  @ApiPropertyOptional({ type: MessageResponseDto, nullable: true })
  lastMessage!: MessageResponseDto | null;

  @ApiProperty()
  unreadCount!: number;
}

export class OffsetPageInfoResponseDto {
  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  hasMore!: boolean;
}

export class SupportTicketRequesterResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ example: "emir" })
  username!: string;

  @ApiProperty({ example: "emir@example.com" })
  email!: string;
}

export class SupportTicketActivityResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  ticketId!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  actorId!: string | null;

  @ApiProperty({ enum: SupportTicketActivityAction })
  action!: SupportTicketActivityAction;

  @ApiPropertyOptional({ nullable: true })
  fromValue!: string | null;

  @ApiPropertyOptional({ nullable: true })
  toValue!: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiPropertyOptional({
    type: SupportTicketRequesterResponseDto,
    nullable: true,
  })
  actor!: SupportTicketRequesterResponseDto | null;
}

export class SupportTicketResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  requesterId!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  assignedAdminId!: string | null;

  @ApiProperty({ example: "I cannot join the release group" })
  subject!: string;

  @ApiProperty({ example: "The group opens, but joining returns an error." })
  message!: string;

  @ApiProperty({ enum: SupportTicketPriority })
  priority!: SupportTicketPriority;

  @ApiProperty({ enum: SupportTicketStatus })
  status!: SupportTicketStatus;

  @ApiPropertyOptional({ nullable: true })
  adminNote!: string | null;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  resolvedAt!: string | null;

  @ApiPropertyOptional({
    type: SupportTicketRequesterResponseDto,
    nullable: true,
  })
  requester!: SupportTicketRequesterResponseDto | null;

  @ApiPropertyOptional({
    type: SupportTicketRequesterResponseDto,
    nullable: true,
  })
  assignedAdmin!: SupportTicketRequesterResponseDto | null;

  @ApiProperty({ type: [SupportTicketActivityResponseDto] })
  activities!: SupportTicketActivityResponseDto[];
}

export class SupportTicketListResponseDto {
  @ApiProperty({ type: [SupportTicketResponseDto] })
  items!: SupportTicketResponseDto[];

  @ApiProperty({ type: OffsetPageInfoResponseDto })
  pageInfo!: OffsetPageInfoResponseDto;
}

export class ConversationListResponseDto {
  @ApiProperty({ type: [ConversationSummaryResponseDto] })
  items!: ConversationSummaryResponseDto[];

  @ApiProperty({ type: OffsetPageInfoResponseDto })
  pageInfo!: OffsetPageInfoResponseDto;
}

export class CursorPageInfoResponseDto {
  @ApiProperty()
  limit!: number;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  before!: string | null;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  nextBefore!: string | null;

  @ApiProperty()
  hasMore!: boolean;
}

export class MessageListResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  items!: MessageResponseDto[];

  @ApiProperty({ type: CursorPageInfoResponseDto })
  pageInfo!: CursorPageInfoResponseDto;
}

export class MessageSearchPageInfoResponseDto {
  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}

export class MessageSearchResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  items!: MessageResponseDto[];

  @ApiProperty({ type: MessageSearchPageInfoResponseDto })
  pageInfo!: MessageSearchPageInfoResponseDto;
}

export class ReadStateResponseDto {
  @ApiProperty({ format: "uuid" })
  conversationId!: string;

  @ApiProperty({ format: "date-time" })
  readAt!: string;

  @ApiProperty()
  unreadCount!: number;
}

export class ParticipantLeftResponseDto {
  @ApiProperty({ format: "uuid" })
  conversationId!: string;

  @ApiProperty({ format: "uuid" })
  userId!: string;

  @ApiProperty({ format: "date-time" })
  leftAt!: string;
}

export class HealthResponseDto {
  @ApiProperty({ example: "ok" })
  status!: string;

  @ApiProperty({ example: "chat-app-backend" })
  service!: string;

  @ApiProperty()
  uptime!: number;

  @ApiProperty({ format: "date-time" })
  timestamp!: string;
}

export class DevResetResponseDto {
  @ApiProperty({ type: Object })
  bookmarks!: Record<string, number>;

  @ApiProperty({ type: Object })
  calls!: Record<string, number>;

  @ApiProperty({ type: Object })
  contactInvitations!: Record<string, number>;

  @ApiProperty({ type: Object })
  conversations!: Record<string, number>;

  @ApiProperty({ type: Object })
  tickets!: Record<string, number>;

  @ApiProperty({ type: Object })
  users!: Record<string, number>;
}

export class MetricsCountersResponseDto {
  @ApiProperty()
  httpRequestsTotal!: number;

  @ApiProperty()
  httpErrorsTotal!: number;

  @ApiProperty()
  httpDurationMsTotal!: number;

  @ApiProperty()
  socketConnectionsTotal!: number;

  @ApiProperty()
  socketDisconnectsTotal!: number;

  @ApiProperty()
  socketEventsTotal!: number;

  @ApiProperty()
  socketErrorsTotal!: number;

  @ApiProperty()
  messagesCreatedTotal!: number;
}

export class MetricsGaugesResponseDto {
  @ApiProperty()
  activeSockets!: number;

  @ApiProperty()
  averageHttpDurationMs!: number;
}

export class MetricsResponseDto {
  @ApiProperty()
  uptimeSeconds!: number;

  @ApiProperty({ type: MetricsCountersResponseDto })
  counters!: MetricsCountersResponseDto;

  @ApiProperty({ type: MetricsGaugesResponseDto })
  gauges!: MetricsGaugesResponseDto;

  @ApiProperty({
    type: "object",
    additionalProperties: { type: "number" },
  })
  socketEventsByName!: Record<string, number>;

  @ApiProperty({ format: "date-time" })
  collectedAt!: string;
}
