import { takeEvery, fork, put, all, call } from "redux-saga/effects";

//Account Redux states
import { AuthRegisterActionTypes } from "./types";
import {
  authRegisterApiResponseSuccess,
  authRegisterApiResponseError,
} from "./actions";

import { postFakeRegister } from "../../../api/index";

// Is user register successfull then direct plot user in redux.
function* registerUser({ payload: { user } }: any) {
  try {
    const response: Promise<any> = yield call(postFakeRegister, user);
    yield put(
      authRegisterApiResponseSuccess(
        AuthRegisterActionTypes.REGISTER_USER,
        response,
      ),
    );
  } catch (error: any) {
    yield put(
      authRegisterApiResponseError(
        AuthRegisterActionTypes.REGISTER_USER,
        error,
      ),
    );
  }
}

export function* watchUserRegister() {
  yield takeEvery(AuthRegisterActionTypes.REGISTER_USER, registerUser);
}

function* registerSaga() {
  yield all([fork(watchUserRegister)]);
}

export default registerSaga;
