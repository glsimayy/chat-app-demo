import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ModerationResolutionAction } from "../moderation-resolution-action.enum";

export class ResolveMessageReportDto {
  @ApiProperty({ enum: ModerationResolutionAction })
  @IsEnum(ModerationResolutionAction)
  action!: ModerationResolutionAction;

  @ApiProperty({
    description: "Decision rationale stored with the moderation record",
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  note!: string;

  @ApiProperty({
    format: "uuid",
    description:
      "Matching content access audit created by this administrator for the reported message",
  })
  @IsUUID()
  evidenceAuditId!: string;

  @ApiPropertyOptional({
    default: 24,
    minimum: 1,
    maximum: 720,
    description: "Temporary suspension duration, used only by suspend_user",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  suspensionHours?: number = 24;
}
