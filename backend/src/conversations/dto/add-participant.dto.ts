import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AddParticipantDto {
  @ApiProperty({ example: "7d6e9940-e1a4-48e9-90d0-7a624b7c7c75" })
  @IsUUID()
  userId!: string;
}
