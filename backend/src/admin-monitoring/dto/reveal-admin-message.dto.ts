import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";
import { AdminMessageAccessReason } from "../admin-message-access-reason.enum";

export class RevealAdminMessageDto {
  @ApiProperty({ enum: AdminMessageAccessReason })
  @IsEnum(AdminMessageAccessReason)
  reason!: AdminMessageAccessReason;

  @ApiProperty({
    description:
      "Case-specific explanation recorded in the immutable access audit",
    example: "Investigating support ticket TICKET-4821 after user consent.",
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  justification!: string;
}
