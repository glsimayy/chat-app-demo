import {
  Body,
  Controller,
  Delete,
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
import { MessageBookmarkResponseDto } from "../common/swagger/backend-response.dto";
import { BookmarksService } from "./bookmarks.service";
import { CreateMessageBookmarkDto } from "./dto/create-message-bookmark.dto";
import { UpdateMessageBookmarkDto } from "./dto/update-message-bookmark.dto";

@ApiTags("bookmarks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("bookmarks")
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  @ApiSuccessResponse(MessageBookmarkResponseDto, {
    description: "Message bookmarks owned by the current user",
    isArray: true,
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.bookmarksService.findAll(user.id);
  }

  @Post()
  @ApiSuccessResponse(MessageBookmarkResponseDto, {
    description: "Message bookmarked",
    status: 201,
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMessageBookmarkDto,
  ) {
    return this.bookmarksService.create(user.id, dto);
  }

  @Patch(":messageId")
  @ApiSuccessResponse(MessageBookmarkResponseDto, {
    description: "Bookmark title updated",
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Body() dto: UpdateMessageBookmarkDto,
  ) {
    return this.bookmarksService.update(user.id, messageId, dto);
  }

  @Delete(":messageId")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
  ) {
    return this.bookmarksService.remove(user.id, messageId);
  }
}
