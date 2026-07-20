import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { ParticipantRole } from "../participant-role.enum";

export class UpdateParticipantRoleDto {
  @ApiProperty({ enum: [ParticipantRole.Manager, ParticipantRole.Member] })
  @IsIn([ParticipantRole.Manager, ParticipantRole.Member])
  role!: ParticipantRole.Manager | ParticipantRole.Member;
}
