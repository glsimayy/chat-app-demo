import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class ConversationEventPayloadDto {
  @IsUUID("4")
  conversationId!: string;
}

export class SendMessagePayloadDto extends ConversationEventPayloadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsUUID("4")
  clientMessageId?: string;
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

export class SyncConversationsPayloadDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  conversationIds!: string[];
}

export class StartCallPayloadDto extends ConversationEventPayloadDto {
  @IsUUID("4")
  targetUserId!: string;
}

export class CallEventPayloadDto {
  @IsUUID("4")
  callId!: string;
}

export class RejectCallPayloadDto extends CallEventPayloadDto {
  @IsOptional()
  @IsIn(["declined", "busy"])
  reason?: "declined" | "busy";
}

export class CallSignalPayloadDto extends CallEventPayloadDto {
  @IsIn(["offer", "answer", "ice-candidate"])
  signalType!: "offer" | "answer" | "ice-candidate";

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  sdp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  candidate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sdpMid?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  sdpMLineIndex?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  usernameFragment?: string | null;
}
