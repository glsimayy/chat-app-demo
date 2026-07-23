import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { ContactInvitationStatus } from "../contact-invitation-status.enum";

const RESPONSE_STATUSES = [
  ContactInvitationStatus.Accepted,
  ContactInvitationStatus.Declined,
] as const;

export class RespondContactInvitationDto {
  @ApiProperty({ enum: RESPONSE_STATUSES })
  @IsIn(RESPONSE_STATUSES)
  status!: ContactInvitationStatus.Accepted | ContactInvitationStatus.Declined;
}
