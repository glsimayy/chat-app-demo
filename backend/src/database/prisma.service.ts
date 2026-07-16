import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly prismaClient?: PrismaClient;

  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>("DATABASE_URL")?.trim();

    if (databaseUrl) {
      this.prismaClient = new PrismaClient({
        datasources: { db: { url: databaseUrl } },
      });
    }
  }

  get enabled() {
    return Boolean(this.prismaClient);
  }

  get client() {
    if (!this.prismaClient) {
      throw new Error("Database persistence is not configured");
    }

    return this.prismaClient;
  }

  async onModuleInit() {
    if (!this.prismaClient) {
      this.logger.warn(
        "DATABASE_URL is not set; using in-memory storage for this process",
      );
      return;
    }

    await this.prismaClient.$connect();
    this.logger.log("Connected to PostgreSQL through Prisma");
  }

  async onModuleDestroy() {
    await this.prismaClient?.$disconnect();
  }
}
