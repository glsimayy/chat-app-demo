import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { SupportTicketPriority } from "../support-ticket-priority.enum";
import { SupportTicketStatus } from "../support-ticket-status.enum";
import { SupportTicketAssignmentFilter } from "../support-ticket-assignment-filter.enum";

export class FindSupportTicketsQueryDto {
  @ApiPropertyOptional({
    enum: SupportTicketAssignmentFilter,
    default: SupportTicketAssignmentFilter.All,
  })
  @IsOptional()
  @IsEnum(SupportTicketAssignmentFilter)
  assignment?: SupportTicketAssignmentFilter =
    SupportTicketAssignmentFilter.All;

  @ApiPropertyOptional({ enum: SupportTicketStatus })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ enum: SupportTicketPriority })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @ApiPropertyOptional({ example: "release group" })
  @IsOptional()
  @IsString()
  search?: string;

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
