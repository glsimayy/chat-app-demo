import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { SupportTicketPriority } from "../support-ticket-priority.enum";
import { SupportTicketStatus } from "../support-ticket-status.enum";

export class UpdateSupportTicketDto {
  @ApiPropertyOptional({ enum: SupportTicketStatus })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ enum: SupportTicketPriority })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @ApiPropertyOptional({
    example: "Access was restored after refreshing the participant record.",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
