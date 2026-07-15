import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import {
  AuthResponseDto,
  PasswordChangedResponseDto,
  UserResponseDto,
} from "../common/swagger/backend-response.dto";
import { AuthenticatedUser } from "./authenticated-user.interface";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiSuccessResponse(AuthResponseDto, {
    description: "User registered successfully",
    status: 201,
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiSuccessResponse(AuthResponseDto, {
    description: "User logged in successfully",
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiSuccessResponse(UserResponseDto, {
    description: "Current authenticated user",
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Patch("password")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiSuccessResponse(PasswordChangedResponseDto, {
    description: "Password changed successfully",
  })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }
}
