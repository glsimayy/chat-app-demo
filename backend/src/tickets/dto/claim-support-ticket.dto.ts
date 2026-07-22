import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class ClaimSupportTicketDto {
  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
