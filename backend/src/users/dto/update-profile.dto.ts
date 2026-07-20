import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: "emir" })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: "username can only contain letters, numbers and underscores",
  })
  username?: string;

  @ApiPropertyOptional({ example: "Available for project coordination." })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  about?: string | null;

  @ApiPropertyOptional({ example: "Istanbul, TR" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string | null;

  @ApiPropertyOptional({
    description: "Compressed PNG, JPEG or WebP data URL",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(700_000)
  @Matches(/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/, {
    message: "profileImage must be a PNG, JPEG or WebP data URL",
  })
  profileImage?: string | null;
}
