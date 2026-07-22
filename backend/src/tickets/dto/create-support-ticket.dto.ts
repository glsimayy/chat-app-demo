import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";
import { SupportTicketPriority } from "../support-ticket-priority.enum";

export class CreateSupportTicketDto {
  @ApiProperty({ example: "I cannot join the release group" })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject!: string;

  @ApiProperty({
    example: "The group opens, but joining it returns an error.",
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  @ApiProperty({
    enum: SupportTicketPriority,
    default: SupportTicketPriority.Medium,
  })
  @IsEnum(SupportTicketPriority)
  priority!: SupportTicketPriority;
}
