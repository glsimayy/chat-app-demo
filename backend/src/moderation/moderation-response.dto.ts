import { ApiProperty } from "@nestjs/swagger";

export class MessageReportResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  status!: string;
}

export class MessageReportListResponseDto {
  @ApiProperty({ type: [Object] })
  items!: Record<string, unknown>[];

  @ApiProperty({ type: Object })
  pageInfo!: Record<string, number | boolean>;
}
