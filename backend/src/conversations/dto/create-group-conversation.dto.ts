import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateGroupConversationDto {
  @ApiProperty({ example: "Staj Proje Ekibi" })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    example: [
      "7d6e9940-e1a4-48e9-90d0-7a624b7c7c75",
      "0b991e0b-814d-4ab4-a918-cfdc1ea19a7a",
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  participantIds!: string[];
}
