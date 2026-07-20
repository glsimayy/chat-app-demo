import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateBotGroupDto {
  @ApiPropertyOptional({
    description: "Deprecated alias: this user is added as a manager",
    example: "7d6e9940-e1a4-48e9-90d0-7a624b7c7c75",
  })
  @IsOptional()
  @IsUUID("4")
  ownerId?: string;

  @ApiProperty({ example: "Destek Talebi #4821" })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    example: [
      "0b991e0b-814d-4ab4-a918-cfdc1ea19a7a",
      "f0adce02-7452-44c5-9a94-60e7b27ae4f0",
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  participantIds!: string[];

  @ApiPropertyOptional({
    description: "Group managers; they are automatically added as members",
    example: ["7d6e9940-e1a4-48e9-90d0-7a624b7c7c75"],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
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
