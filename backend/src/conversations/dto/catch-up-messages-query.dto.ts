import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { CatchUpWindow } from "../catch-up-window.enum";

export class CatchUpMessagesQueryDto {
  @ApiPropertyOptional({
    enum: CatchUpWindow,
    default: CatchUpWindow.TwoHours,
    description: "Time window included in the deterministic activity summary",
  })
  @IsOptional()
  @IsEnum(CatchUpWindow)
  window?: CatchUpWindow = CatchUpWindow.TwoHours;
}
