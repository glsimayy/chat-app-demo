import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { BotModule } from "./bot/bot.module";
import { ChatModule } from "./chat/chat.module";
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";
import { validateEnv } from "./config/env.validation";
import { ConversationsModule } from "./conversations/conversations.module";
import { DevModule } from "./dev/dev.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { MetricsModule } from "./metrics/metrics.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: Number(configService.get<string>("RATE_LIMIT_TTL_MS", "60000")),
          limit: Number(configService.get<string>("RATE_LIMIT_MAX", "120")),
        },
      ],
    }),
    HealthModule,
    MetricsModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    ConversationsModule,
    ChatModule,
    BotModule,
    DevModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
