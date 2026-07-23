import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateContactInvitationDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "Let's connect on ellO." })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}
