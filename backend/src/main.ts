import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureApplication } from "./config/configure-application";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const { port } = configureApplication(app);
  await app.listen(port);
}

void bootstrap();
