import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PublicUser } from "../users/user.types";
import { UsersService } from "../users/users.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const userRecord = await this.usersService.findByEmail(dto.email);

    if (!userRecord) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (this.usersService.isSuspended(userRecord)) {
      throw new UnauthorizedException(
        `Account suspended until ${userRecord.suspendedUntil?.toISOString()}`,
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      userRecord.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.buildAuthResponse(this.usersService.toPublicUser(userRecord));
  }

  async getMe(userId: string): Promise<PublicUser> {
    const userRecord = await this.usersService.findById(userId);

    if (!userRecord) {
      throw new UnauthorizedException("User no longer exists");
    }

    return userRecord;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const userRecord = await this.usersService.findRecordById(userId);

    if (!userRecord) {
      throw new UnauthorizedException("User no longer exists");
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      userRecord.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid current password");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const user = await this.usersService.updatePasswordHash(
      userId,
      passwordHash,
    );

    return {
      user,
      changedAt: new Date(),
    };
  }

  private async buildAuthResponse(user: PublicUser): Promise<AuthResponse> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { accessToken, user };
  }
}
