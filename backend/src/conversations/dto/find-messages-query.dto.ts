import { Type } from "class-transformer";
import { IsInt, IsISO8601, IsOptional, Max, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class FindMessagesQueryDto {
  @ApiPropertyOptional({
    default: 50,
    maximum: 100,
    minimum: 1,
    description: "Maximum number of messages to return",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    example: "2026-07-13T17:00:00.000Z",
    description: "Return messages created before this ISO date",
  })
  @IsOptional()
  @IsISO8601()
  before?: string;
}
