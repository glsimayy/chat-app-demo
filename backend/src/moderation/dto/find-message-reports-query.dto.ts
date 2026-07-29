import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { MessageReportReason } from "../message-report-reason.enum";
import { MessageReportStatus } from "../message-report-status.enum";

export class FindMessageReportsQueryDto {
  @ApiPropertyOptional({ enum: MessageReportStatus })
  @IsOptional()
  @IsEnum(MessageReportStatus)
  status?: MessageReportStatus;

  @ApiPropertyOptional({ enum: MessageReportReason })
  @IsOptional()
  @IsEnum(MessageReportReason)
  reason?: MessageReportReason;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
