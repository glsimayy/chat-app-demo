import { ApiProperty } from "@nestjs/swagger";
import { IsDefined, IsInt, IsUUID, Min, ValidateIf } from "class-validator";

export class AssignSupportTicketDto {
  @ApiProperty({ format: "uuid", nullable: true })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  adminId!: string | null;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
