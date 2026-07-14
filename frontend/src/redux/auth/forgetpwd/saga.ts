import { takeEvery, fork, put, all, call } from "redux-saga/effects";

// Login Redux States
import { AuthForgetPassActionTypes } from "./types";
import {
  authForgetPassApiResponseSuccess,
  authForgetPassApiResponseError,
} from "./actions";

import {
  postFakeForgetPwd,
  changePassword as changePasswordApi,
} from "../../../api/index";

//If user is send successfully send mail link then dispatch redux action's are directly from here.
function* forgetUser({ payload: user }: any) {
  try {
    yield call(postFakeForgetPwd, {
      email: user.email,
    });
    yield put(
      authForgetPassApiResponseSuccess(
        AuthForgetPassActionTypes.FORGET_PASSWORD,
        "Reset link are sended to your mailbox, check there first",
      ),
    );
  } catch (error: any) {
    yield put(
      authForgetPassApiResponseError(
        AuthForgetPassActionTypes.FORGET_PASSWORD,
        error,
      ),
    );
  }
}

function* changePassword({ payload: newPassword }: any) {
  try {
    yield call(changePasswordApi, newPassword);
    yield put(
      authForgetPassApiResponseSuccess(
        AuthForgetPassActionTypes.CHANGE_PASSWORD,
        "Your Password is Changed",
      ),
    );
  } catch (error: any) {
    yield put(
      authForgetPassApiResponseError(
        AuthForgetPassActionTypes.CHANGE_PASSWORD,
        error,
      ),
    );
  }
}

export function* watchUserPasswordForget() {
  yield takeEvery(AuthForgetPassActionTypes.FORGET_PASSWORD, forgetUser);
}

export function* watchUserChangePassword() {
  yield takeEvery(AuthForgetPassActionTypes.CHANGE_PASSWORD, changePassword);
}

function* forgetPasswordSaga() {
  yield all([fork(watchUserPasswordForget), fork(watchUserChangePassword)]);
}

export default forgetPasswordSaga;
