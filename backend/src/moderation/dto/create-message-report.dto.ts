import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { MessageReportReason } from "../message-report-reason.enum";

export class CreateMessageReportDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  messageId!: string;

  @ApiProperty({ enum: MessageReportReason })
  @IsEnum(MessageReportReason)
  reason!: MessageReportReason;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
