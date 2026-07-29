import { ApiProperty } from "@nestjs/swagger";
import { AdminMessageAccessReason } from "./admin-message-access-reason.enum";

export class AdminOverviewResponseDto {
  @ApiProperty({ type: Object })
  totals!: Record<string, number>;

  @ApiProperty({ type: Object })
  activity24h!: Record<string, number>;

  @ApiProperty({ type: Object })
  runtime!: Record<string, unknown>;

  @ApiProperty()
  collectedAt!: Date;
}

export class AdminMessageListResponseDto {
  @ApiProperty({ type: [Object] })
  items!: Record<string, unknown>[];

  @ApiProperty({ type: Object })
  pageInfo!: Record<string, number | boolean>;
}

export class AdminMessageRevealResponseDto {
  @ApiProperty()
  auditId!: string;

  @ApiProperty()
  messageId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ type: [Object] })
  attachments!: Record<string, unknown>[];

  @ApiProperty()
  revealedAt!: Date;
}

export class AdminAccessAuditListResponseDto {
  @ApiProperty({ type: [Object] })
  items!: Record<string, unknown>[];

  @ApiProperty({ type: Object })
  pageInfo!: Record<string, number | boolean>;
}

export class AdminMessageAccessAuditDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AdminMessageAccessReason })
  reason!: AdminMessageAccessReason;
}
