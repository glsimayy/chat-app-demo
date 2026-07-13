import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateBotGroupDto {
  @ApiProperty({ example: "7d6e9940-e1a4-48e9-90d0-7a624b7c7c75" })
  @IsUUID("4")
  ownerId!: string;

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

  @ApiPropertyOptional({ example: "ticket-4821" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string;

  @ApiPropertyOptional({
    example: "Bot tarafindan destek grubu acildi.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  initialSystemMessage?: string;
}
