import { APIClient } from "./apiCore";
import { mapAuthResponse } from "./backendAdapters";
import * as url from "./urls";

const api = new APIClient();

// postForgetPwd
const postFakeForgetPwd = (data: any) =>
  api.create(url.POST_FAKE_PASSWORD_FORGET, data);

// postForgetPwd
const postJwtForgetPwd = (data: any) =>
  api.create(url.POST_FAKE_JWT_PASSWORD_FORGET, data);

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

// postSocialLogin
const postSocialLogin = (data: any) => api.create(url.SOCIAL_LOGIN, data);

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
