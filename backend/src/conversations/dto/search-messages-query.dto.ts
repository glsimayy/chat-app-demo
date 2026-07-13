import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsString, Max, Min, MinLength } from "class-validator";

export class SearchMessagesQueryDto {
  @ApiProperty({ example: "merhaba" })
  @IsString()
  @MinLength(1)
  q!: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
