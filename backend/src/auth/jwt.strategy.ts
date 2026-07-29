import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UsersService } from "../users/users.service";
import { AuthenticatedUser } from "./authenticated-user.interface";

interface JwtPayload {
  sub: string;
  email: string;
  role: AuthenticatedUser["role"];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET", "dev-secret"),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findRecordById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }
    if (this.usersService.isSuspended(user)) {
      throw new UnauthorizedException(
        `Account suspended until ${user.suspendedUntil?.toISOString()}`,
      );
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
