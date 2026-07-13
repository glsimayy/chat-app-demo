import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID } from "class-validator";

export class CreateDirectConversationDto {
  @ApiProperty({ example: "7d6e9940-e1a4-48e9-90d0-7a624b7c7c75" })
  @IsString()
  @IsUUID()
  participantId!: string;
}
