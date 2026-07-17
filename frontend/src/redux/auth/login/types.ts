export enum AuthLoginActionTypes {
  API_RESPONSE_SUCCESS = "@@auth/login/API_RESPONSE_SUCCESS",
  API_RESPONSE_ERROR = "@@auth/login/API_RESPONSE_ERROR",

  LOGIN_USER = "@@auth/login/LOGIN_USER",
  LOGOUT_USER = "@@auth/login/LOGOUT_USER",
  CLEAR_LOGIN_ERROR = "@@auth/login/CLEAR_LOGIN_ERROR",
}
export interface AuthLoginState {
  error: string;
  loading: boolean;
  retryAfterUntil?: number;
}
