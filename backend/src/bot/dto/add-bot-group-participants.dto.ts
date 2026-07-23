import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
} from "class-validator";

export class AddBotGroupParticipantsDto {
  @ApiProperty({
    description:
      "User UUIDs or built-in automation IDs to add or reactivate",
    example: ["2", "4"],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  participantIds!: string[];

  @ApiPropertyOptional({
    description:
      "Added user UUIDs or built-in automation IDs that should become managers",
    example: ["1"],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  managerIds?: string[];
}
