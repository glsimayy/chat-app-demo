import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { MetricsResponseDto } from "../common/swagger/backend-response.dto";
import { UserRole } from "../users/user-role.enum";
import { MetricsService } from "./metrics.service";

@ApiTags("metrics")
@ApiBearerAuth()
@Controller("metrics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiSuccessResponse(MetricsResponseDto, {
    description: "In-process HTTP, socket and message metrics",
  })
  getMetrics() {
    return this.metricsService.getSnapshot();
  }
}
