import axios from "axios";
import config from "../config";
import { ApiErrorDetails, normalizeApiError } from "./apiErrors";

export type { ApiErrorDetails } from "./apiErrors";

// default
axios.defaults.baseURL = config.API_URL;

// content type
axios.defaults.headers.post["Content-Type"] = "application/json";

axios.interceptors.request.use((request: any) => {
  const rawUser = localStorage.getItem("authUser");

  if (rawUser) {
    try {
      const user = JSON.parse(rawUser);
      const token = user?.accessToken || user?.token;

      if (token) {
        request.headers = request.headers || {};
        request.headers.Authorization = "Bearer " + token;
      }
    } catch {
      localStorage.removeItem("authUser");
    }
  }

  return request;
});

// intercepting to capture errors
axios.interceptors.response.use(
  function (response: any) {
    const payload = response.data ? response.data : response;

    if (
      payload &&
      typeof payload === "object" &&
      Object.prototype.hasOwnProperty.call(payload, "success") &&
      Object.prototype.hasOwnProperty.call(payload, "data")
    ) {
      return payload.data;
    }

    return payload;
  },
  function (error: any) {
    const status = error.response?.status || error.status;
    const requestUrl = error.config?.url || "";
    const isLoginRequest = requestUrl.endsWith("/auth/login");
    const isPublicAuthRequest = ["/auth/login", "/auth/register"].some(path =>
      requestUrl.endsWith(path),
    );

    if (status === 401 && !isPublicAuthRequest) {
      localStorage.removeItem("authUser");

      if (window.location.pathname !== "/auth-login") {
        window.location.replace("/auth-login");
      }
    }

    if (status === 429 && isLoginRequest) {
      const normalized = normalizeApiError(error);
      const rateLimitError: ApiErrorDetails = {
        message: "Too many login attempts.",
        retryAfterSeconds: normalized.retryAfterSeconds,
      };

      return Promise.reject(rateLimitError);
    }

    return Promise.reject(normalizeApiError(error).message);
  },
);

/**
 * Sets the default authorization
 * @param {*} token
 */
const setAuthorization = (token: any) => {
  axios.defaults.headers.common["Authorization"] = "Bearer " + token;
};

class APIClient {
  /**
   * Fetches data from given url
   */
  get = (url: string, params?: {}) => {
    return axios.get(url, params);
  };

  /**
   * post given data to url
   */
  create = (url: string, data?: {}) => {
    return axios.post(url, data);
  };

  /**
   * Updates data
   */
  update = (url: string, data?: {}) => {
    return axios.put(url, data);
  };

  patch = (url: string, data?: {}) => {
    return axios.patch(url, data);
  };

  /**
   * Delete
   */
  delete = (url: string, config?: {}) => {
    return axios.delete(url, { ...config });
  };

  /*
   file upload update method
  */
  updateWithFile = (url: string, data: any) => {
    const formData = new FormData();
    for (const k in data) {
      formData.append(k, data[k]);
    }
    // const config = {
    //   headers: {
    //     ...axios.defaults.headers,
    //     "content-type": "multipart/form-data",
    //   },
    // };
    // return axios.put(url, formData, config);
  };

  /*
   file upload post method
   */
  createWithFile = (url: string, data: any) => {
    const formData = new FormData();
    for (const k in data) {
      formData.append(k, data[k]);
    }
    // const config = {
    //   headers: {
    //     ...axios.defaults.headers,
    //     "content-type": "multipart/form-data",
    //   },
    // };
    return axios.post(url, formData);
  };
}

const getLoggedinUser = () => {
  const user = localStorage.getItem("authUser");

  if (!user) {
    return null;
  }

  try {
    return JSON.parse(user);
  } catch {
    localStorage.removeItem("authUser");
    return null;
  }
};

export { APIClient, setAuthorization, getLoggedinUser };
