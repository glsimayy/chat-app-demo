import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

@ApiTags("health")
@Controller("health")
@SkipThrottle()
export class HealthController {
  @Get()
  @ApiOkResponse({ description: "Backend health status" })
  getHealth() {
    return {
      status: "ok",
      service: "chat-app-backend",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
