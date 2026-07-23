import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import {
  ContactInvitationActionResponseDto,
  ContactInvitationResponseDto,
} from "../common/swagger/backend-response.dto";
import { ContactInvitationsService } from "./contact-invitations.service";
import { CreateContactInvitationDto } from "./dto/create-contact-invitation.dto";
import { RespondContactInvitationDto } from "./dto/respond-contact-invitation.dto";

@ApiTags("contact invitations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("contact-invitations")
export class ContactInvitationsController {
  constructor(
    private readonly contactInvitationsService: ContactInvitationsService,
  ) {}

  @Post()
  @ApiSuccessResponse(ContactInvitationResponseDto, {
    description: "Contact invitation created",
    status: 201,
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContactInvitationDto,
  ) {
    return this.contactInvitationsService.create(user.id, dto);
  }

  @Get()
  @ApiSuccessResponse(ContactInvitationResponseDto, {
    description: "Pending invitations received by the current user",
    isArray: true,
  })
  findReceived(@CurrentUser() user: AuthenticatedUser) {
    return this.contactInvitationsService.findReceived(user.id);
  }

  @Patch(":invitationId")
  @ApiSuccessResponse(ContactInvitationActionResponseDto, {
    description: "Contact invitation accepted or declined",
  })
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param("invitationId", new ParseUUIDPipe()) invitationId: string,
    @Body() dto: RespondContactInvitationDto,
  ) {
    return this.contactInvitationsService.respond(invitationId, user.id, dto);
  }
}
