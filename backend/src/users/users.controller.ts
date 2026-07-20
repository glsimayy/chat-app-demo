import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedUser } from "../auth/authenticated-user.interface";
import { CurrentUser } from "../auth/current-user.decorator";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { UserResponseDto } from "../common/swagger/backend-response.dto";
import { UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiQuery({ name: "search", required: false })
  @ApiSuccessResponse(UserResponseDto, {
    description: "Registered users",
    isArray: true,
  })
  findAll(@Query("search") search?: string) {
    return this.usersService.findAll(search);
  }

  @Get("me")
  @ApiSuccessResponse(UserResponseDto, {
    description: "Current user's profile",
  })
  async findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }

  @Patch("me")
  @ApiSuccessResponse(UserResponseDto, {
    description: "Current user's profile updated",
  })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get(":userId")
  @ApiSuccessResponse(UserResponseDto, {
    description: "Registered user profile",
  })
  async findOne(@Param("userId", new ParseUUIDPipe()) userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }
}
