import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateBotGroupDto {
  @ApiPropertyOptional({
    description:
      "Deprecated alias: UUID or built-in automation ID; this user is added as a manager",
    example: "1",
  })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiProperty({ example: "Destek Talebi #4821" })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    description: "User UUIDs or built-in automation IDs",
    example: ["2", "4"],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  participantIds!: string[];

  @ApiPropertyOptional({
    description:
      "Manager UUIDs or built-in automation IDs; managers are added as members",
    example: ["1"],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  managerIds?: string[];

  @ApiPropertyOptional({ example: "Customer support coordination" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  memberCanSendMessages?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  membersCanLeave?: boolean;

  @ApiPropertyOptional({ example: "Support system" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceName?: string;

  @ApiPropertyOptional({ example: "ticket-4821" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string;

  @ApiPropertyOptional({
    example: "Support request received. An agent will join shortly.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  initialSystemMessage?: string;

  @ApiPropertyOptional({
    description: "Preferred field for the first message sent by the bot",
    example: "Support request received. An agent will join shortly.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  initialBotMessage?: string;
}
