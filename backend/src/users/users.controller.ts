import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiSuccessResponse } from "../common/swagger/api-success-response.decorator";
import { UserResponseDto } from "../common/swagger/backend-response.dto";
import { UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";

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
