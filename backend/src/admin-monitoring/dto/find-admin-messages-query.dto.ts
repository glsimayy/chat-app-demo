import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { ConversationType } from "../../conversations/conversation-type.enum";

export class FindAdminMessagesQueryDto {
  @ApiPropertyOptional({
    description:
      "Search sender identity and conversation name. Message contents are never searched.",
    example: "support",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by sender UUID" })
  @IsOptional()
  @IsString()
  senderId?: string;

  @ApiPropertyOptional({ description: "Filter by conversation UUID" })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ enum: ConversationType })
  @IsOptional()
  @IsEnum(ConversationType)
  conversationType?: ConversationType;

  @ApiPropertyOptional({
    description: "Include messages created at or after this ISO timestamp",
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: "Include messages created at or before this ISO timestamp",
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: "Filter by attachment presence" })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  hasAttachments?: boolean;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
