import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
} from "class-validator";

export class AddBotGroupParticipantsDto {
  @ApiProperty({
    description: "Users to add or reactivate in the automation group",
    example: [
      "0b991e0b-814d-4ab4-a918-cfdc1ea19a7a",
      "f0adce02-7452-44c5-9a94-60e7b27ae4f0",
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID("4", { each: true })
  participantIds!: string[];

  @ApiPropertyOptional({
    description: "Added users who should become group managers",
    example: ["0b991e0b-814d-4ab4-a918-cfdc1ea19a7a"],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID("4", { each: true })
  managerIds?: string[];
}
