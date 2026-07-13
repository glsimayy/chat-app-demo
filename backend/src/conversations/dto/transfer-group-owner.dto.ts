import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class TransferGroupOwnerDto {
  @ApiProperty({ example: "7d6e9940-e1a4-48e9-90d0-7a624b7c7c75" })
  @IsUUID("4")
  userId!: string;
}
