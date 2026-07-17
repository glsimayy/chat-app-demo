import { call, put, takeEvery } from "redux-saga/effects";

// Login Redux States
import { AuthLoginActionTypes } from "./types";
import {
  authLoginApiResponseSuccess,
  authLoginApiResponseError,
} from "./actions";

import { postFakeLogin } from "../../../api/index";
import { disconnectChatSocket } from "../../../api/realtime";
import { ApiErrorDetails } from "../../../api/apiCore";

const getLoginError = (error: unknown) => {
  if (typeof error === "string") {
    return { message: error };
  }

  const details = error as Partial<ApiErrorDetails> | null;
  const retryAfterSeconds = details?.retryAfterSeconds;

  return {
    message: details?.message || "Login failed. Please try again.",
    retryAfterUntil:
      typeof retryAfterSeconds === "number"
        ? Date.now() + retryAfterSeconds * 1000
        : undefined,
  };
};

function* loginUser({ payload: { user } }: any) {
  try {
    const response: Promise<any> = yield call(postFakeLogin, {
      email: user.email,
      password: user.password,
    });
    localStorage.setItem("authUser", JSON.stringify(response));
    yield put(
      authLoginApiResponseSuccess(AuthLoginActionTypes.LOGIN_USER, response),
    );
  } catch (error: any) {
    const loginError = getLoginError(error);
    yield put(
      authLoginApiResponseError(
        AuthLoginActionTypes.LOGIN_USER,
        loginError.message,
        loginError.retryAfterUntil,
      ),
    );
  }
}

function* logoutUser() {
  try {
    disconnectChatSocket();
    localStorage.removeItem("authUser");
    yield put(
      authLoginApiResponseSuccess(AuthLoginActionTypes.LOGOUT_USER, true),
    );
  } catch (error: any) {
    yield put(
      authLoginApiResponseError(AuthLoginActionTypes.LOGOUT_USER, error),
    );
  }
}

function* loginSaga() {
  yield takeEvery(AuthLoginActionTypes.LOGIN_USER, loginUser);
  yield takeEvery(AuthLoginActionTypes.LOGOUT_USER, logoutUser);
}

export default loginSaga;
