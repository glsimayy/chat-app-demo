import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BotSecretGuard } from "./bot-secret.guard";

function createContext(secret?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: secret ? { "x-bot-secret": secret } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

function createConfigService(secret: string) {
  return {
    get: jest.fn(() => secret),
  } as unknown as ConfigService;
}

describe("BotSecretGuard", () => {
  it("accepts the configured secret", () => {
    const guard = new BotSecretGuard(createConfigService("shared-secret"));

    expect(guard.canActivate(createContext("shared-secret"))).toBe(true);
  });

  it.each([undefined, "wrong-secret", "shared-secret-with-extra-bytes"])(
    "rejects an invalid secret",
    (secret) => {
      const guard = new BotSecretGuard(createConfigService("shared-secret"));

      expect(() => guard.canActivate(createContext(secret))).toThrow(
        UnauthorizedException,
      );
    },
  );

  it("rejects requests when no secret is configured", () => {
    const guard = new BotSecretGuard(createConfigService(""));

    expect(() => guard.canActivate(createContext("shared-secret"))).toThrow(
      UnauthorizedException,
    );
  });
});
