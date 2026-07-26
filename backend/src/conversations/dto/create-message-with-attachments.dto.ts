import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateMessageWithAttachmentsDto {
  @ApiPropertyOptional({
    example: "Release screenshot",
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({
    description: "Client-generated idempotency key for safe retries",
    example: "3f0fe459-3816-4b83-b60a-5d195797f030",
  })
  @IsOptional()
  @IsUUID("4")
  clientMessageId?: string;

  @ApiPropertyOptional({
    description: "Message in this conversation being replied to",
    example: "ab4d782f-112a-4b6c-9a35-d5a6674f89e3",
  })
  @IsOptional()
  @IsUUID("4")
  replyToMessageId?: string;

  @ApiPropertyOptional({
    description: "Marks a message created by forwarding another message",
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isForwarded?: boolean;
}
