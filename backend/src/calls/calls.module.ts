import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { CallsController } from "./calls.controller";
import { CallsService } from "./calls.service";

@Module({
  imports: [UsersModule],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
