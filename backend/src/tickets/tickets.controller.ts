import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import {
  SupportTicketListResponseDto,
  SupportTicketResponseDto,
} from "../common/swagger/backend-response.dto";
import { UserRole } from "../users/user-role.enum";
import { CreateSupportTicketDto } from "./dto/create-support-ticket.dto";
import { FindSupportTicketsQueryDto } from "./dto/find-support-tickets-query.dto";
import { UpdateSupportTicketDto } from "./dto/update-support-ticket.dto";
import { TicketsService } from "./tickets.service";

@ApiTags("support tickets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiSuccessResponse(SupportTicketResponseDto, {
    description: "Support ticket created",
    status: 201,
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.ticketsService.create(user.id, dto);
  }

  @Get()
  @ApiSuccessResponse(SupportTicketListResponseDto, {
    description: "Visible support tickets",
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindSupportTicketsQueryDto,
  ) {
    return this.ticketsService.findAll(user.id, user.role, query);
  }

  @Get(":ticketId")
  @ApiSuccessResponse(SupportTicketResponseDto, {
    description: "Support ticket detail",
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ticketId", new ParseUUIDPipe()) ticketId: string,
  ) {
    return this.ticketsService.findOne(ticketId, user.id, user.role);
  }

  @Patch(":ticketId")
  @Roles(UserRole.Admin)
  @ApiSuccessResponse(SupportTicketResponseDto, {
    description: "Support ticket updated by an administrator",
  })
  update(
    @Param("ticketId", new ParseUUIDPipe()) ticketId: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.ticketsService.update(ticketId, dto);
  }
}
