import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
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
