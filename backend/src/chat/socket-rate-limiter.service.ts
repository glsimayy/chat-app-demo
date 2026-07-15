import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WsException } from "@nestjs/websockets";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class SocketRateLimiterService {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly limit: number;
  private readonly ttlMs: number;

  constructor(configService: ConfigService) {
    this.limit = Number(
      configService.get<string>("SOCKET_RATE_LIMIT_MAX", "60"),
    );
    this.ttlMs = Number(
      configService.get<string>("SOCKET_RATE_LIMIT_TTL_MS", "10000"),
    );
  }

  consume(socketId: string, eventName: string) {
    const now = Date.now();
    const existingBucket = this.buckets.get(socketId);
    const bucket =
      !existingBucket || existingBucket.resetAt <= now
        ? { count: 0, resetAt: now + this.ttlMs }
        : existingBucket;

    bucket.count += 1;
    this.buckets.set(socketId, bucket);

    if (bucket.count > this.limit) {
      throw new WsException({
        code: "RATE_LIMITED",
        message: "Too many socket events",
        event: eventName,
        retryAfterMs: Math.max(0, bucket.resetAt - now),
      });
    }
  }

  clear(socketId: string) {
    this.buckets.delete(socketId);
  }
}
