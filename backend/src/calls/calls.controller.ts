import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { CallResponseDto } from "./call-response.dto";
import { CallsService } from "./calls.service";

@ApiTags("calls")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("calls")
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  @ApiSuccessResponse(CallResponseDto, {
    description: "Current user's latest audio calls",
    isArray: true,
  })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.callsService.findForUser(user.id);
  }
}
