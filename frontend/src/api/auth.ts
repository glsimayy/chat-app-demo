import { APIClient } from "./apiCore";
import { mapAuthResponse } from "./backendAdapters";

const api = new APIClient();

const unsupportedPasswordReset = (_data?: any) =>
  Promise.reject("Password reset by email is not available yet");

const postFakeForgetPwd = unsupportedPasswordReset;

const postJwtForgetPwd = unsupportedPasswordReset;

const postFakeLogin = (data: any) =>
  api.create("/auth/login", data).then(mapAuthResponse);

const postJwtLogin = (data: any) =>
  api.create("/auth/login", data).then(mapAuthResponse);

// Register Method
const postFakeRegister = (data: any) => {
  return api.create("/auth/register", data).then(mapAuthResponse);
};

// Register Method
const postJwtRegister = (data: any) => {
  return api.create("/auth/register", data).then(mapAuthResponse);
};

const getCurrentUser = () => api.get("/auth/me");

const changePassword = (data: object) => {
  return api.patch("/auth/password", data);
};

const postSocialLogin = (_data?: any) =>
  Promise.reject("Social login is not available yet");

export {
  postFakeForgetPwd,
  postJwtForgetPwd,
  postFakeLogin,
  postJwtLogin,
  postFakeRegister,
  postJwtRegister,
  getCurrentUser,
  changePassword,
  postSocialLogin,
};
