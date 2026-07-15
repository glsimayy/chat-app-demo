import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { HealthResponseDto } from "../common/swagger/backend-response.dto";

@ApiTags("health")
@Controller("health")
@SkipThrottle()
export class HealthController {
  @Get()
  @ApiSuccessResponse(HealthResponseDto, {
    description: "Backend health status",
  })
  getHealth() {
    return {
      status: "ok",
      service: "chat-app-backend",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
