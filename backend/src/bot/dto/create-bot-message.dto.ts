import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateBotMessageDto {
  @ApiProperty({
    example: "Ticket priority changed to high.",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({
    description:
      "Stable UUID used to deduplicate retries from external systems",
    example: "3f0fe459-3816-4b83-b60a-5d195797f030",
  })
  @IsOptional()
  @IsUUID("4")
  clientMessageId?: string;
}
