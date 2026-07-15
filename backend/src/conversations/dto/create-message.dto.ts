import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateMessageDto {
  @ApiProperty({ example: "Selam, nasılsın?" })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({
    description: "Client-generated idempotency key for safe retries",
    example: "3f0fe459-3816-4b83-b60a-5d195797f030",
  })
  @IsOptional()
  @IsUUID("4")
  clientMessageId?: string;
}
