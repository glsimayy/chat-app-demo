import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CallStatus } from "./call-status.enum";

class CallPeerResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ example: "emiruser" })
  username!: string;

  @ApiPropertyOptional({ nullable: true })
  profileImage!: string | null;
}

export class CallResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  conversationId!: string;

  @ApiProperty({ enum: ["incoming", "outgoing"] })
  direction!: "incoming" | "outgoing";

  @ApiProperty({ enum: CallStatus })
  status!: CallStatus;

  @ApiProperty({ format: "date-time" })
  startedAt!: string;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  answeredAt!: string | null;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  endedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  endedReason!: string | null;

  @ApiProperty()
  durationSeconds!: number;

  @ApiProperty({ type: CallPeerResponseDto })
  peer!: CallPeerResponseDto;
}
