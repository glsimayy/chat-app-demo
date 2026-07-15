import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class ConversationEventPayloadDto {
  @IsUUID("4")
  conversationId!: string;
}

export class SendMessagePayloadDto extends ConversationEventPayloadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class UpdateMessagePayloadDto extends SendMessagePayloadDto {
  @IsUUID("4")
  messageId!: string;
}

export class DeleteMessagePayloadDto extends ConversationEventPayloadDto {
  @IsUUID("4")
  messageId!: string;
}

export class UpdateConversationPayloadDto extends ConversationEventPayloadDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;
}

export class TransferOwnerPayloadDto extends ConversationEventPayloadDto {
  @IsUUID("4")
  userId!: string;
}
