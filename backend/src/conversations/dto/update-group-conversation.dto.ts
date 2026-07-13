import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateGroupConversationDto {
  @ApiProperty({ example: "Yeni Grup Adi" })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;
}
