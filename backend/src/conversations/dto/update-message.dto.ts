import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateMessageDto {
  @ApiProperty({ example: "Mesaj duzenlendi." })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
