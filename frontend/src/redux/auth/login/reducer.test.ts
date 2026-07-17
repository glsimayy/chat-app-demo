import Login, { INIT_STATE } from "./reducer";
import { AuthLoginActionTypes } from "./types";

describe("login reducer", () => {
  it("clears an old error when a new login starts", () => {
    const state = Login(
      {
        ...INIT_STATE,
        error: "Invalid credentials",
        retryAfterUntil: 123,
      },
      { type: AuthLoginActionTypes.LOGIN_USER },
    );

    expect(state).toMatchObject({
      error: "",
      loading: true,
      retryAfterUntil: undefined,
    });
  });

  it("stores and clears the login cooldown", () => {
    const limited = Login(INIT_STATE, {
      type: AuthLoginActionTypes.API_RESPONSE_ERROR,
      payload: {
        actionType: AuthLoginActionTypes.LOGIN_USER,
        error: "Too many login attempts.",
        retryAfterUntil: 123,
      },
    });

    expect(limited).toMatchObject({
      error: "Too many login attempts.",
      retryAfterUntil: 123,
    });

    expect(
      Login(limited, { type: AuthLoginActionTypes.CLEAR_LOGIN_ERROR }),
    ).toMatchObject({ error: "", retryAfterUntil: undefined });
  });
});
