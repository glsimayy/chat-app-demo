import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";
import { join } from "node:path";
import { ConfiguredIoAdapter } from "../chat/configured-io.adapter";
import { HttpExceptionFilter } from "../common/filters/http-exception.filter";
import { ResponseInterceptor } from "../common/interceptors/response.interceptor";
import { parseCorsOrigin } from "./cors-origin";

export function configureApplication(app: NestExpressApplication) {
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>("API_PREFIX", "api");
  const corsOrigin = parseCorsOrigin(
    configService.get<string>("CORS_ORIGIN", "*"),
  );
  const bodyLimit = configService.get<string>("BODY_LIMIT", "1mb");
  const swaggerEnabled =
    configService.get<string>("SWAGGER_ENABLED", "true") === "true";
  const serveDemoUi =
    configService.get<string>("SERVE_DEMO_UI", "true") === "true";

  app.setGlobalPrefix(apiPrefix);
  if (serveDemoUi) {
    app.useStaticAssets(join(process.cwd(), "frontend"), {
      prefix: "/demo",
    });
  }
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, corsOrigin));
  app.useBodyParser("json", { limit: bodyLimit });
  app.useBodyParser("urlencoded", { extended: true, limit: bodyLimit });
  app.use(helmet());
  app.use(compression());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Chat App API")
      .setDescription("Realtime chat application backend API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  return {
    port: Number(configService.get<string>("PORT", "3000")),
  };
}
