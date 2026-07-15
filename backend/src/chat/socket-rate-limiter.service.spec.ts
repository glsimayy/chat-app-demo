import { ConfigService } from "@nestjs/config";
import { WsException } from "@nestjs/websockets";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";

describe("SocketRateLimiterService", () => {
  const configValues: Record<string, string> = {
    SOCKET_RATE_LIMIT_MAX: "2",
    SOCKET_RATE_LIMIT_TTL_MS: "1000",
  };
  const configService = {
    get: jest.fn((key: string, fallback: string) => {
      return configValues[key] ?? fallback;
    }),
  } as unknown as ConfigService;

  it("rejects events above the per-socket limit", () => {
    const service = new SocketRateLimiterService(configService);

    service.consume("socket-1", "message:send");
    service.consume("socket-1", "typing:start");

    expect(() => service.consume("socket-1", "message:send")).toThrow(
      WsException,
    );
  });

  it("removes the bucket when a socket disconnects", () => {
    const service = new SocketRateLimiterService(configService);

    service.consume("socket-1", "message:send");
    service.consume("socket-1", "message:send");
    service.clear("socket-1");

    expect(() => service.consume("socket-1", "message:send")).not.toThrow();
  });
});
