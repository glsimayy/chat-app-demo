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
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
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
  @ApiOkResponse({ description: "Registered users" })
  findAll(@Query("search") search?: string) {
    return this.usersService.findAll(search);
  }

  @Get(":userId")
  @ApiOkResponse({ description: "Registered user profile" })
  async findOne(@Param("userId", new ParseUUIDPipe()) userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }
}
