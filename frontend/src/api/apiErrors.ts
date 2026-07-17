export interface ApiErrorDetails {
  message: string;
  retryAfterSeconds?: number;
}

export const normalizeApiError = (error: any): ApiErrorDetails => {
  const status = error?.response?.status || error?.status;
  const responseMessage = error?.response?.data?.message;

  if (!error?.response) {
    return {
      message: "Server unavailable. Check your connection and try again.",
    };
  }

  if (status === 403) {
    return { message: "You do not have permission to perform this action." };
  }

  if (status === 429) {
    const parsedRetryAfter = Number(error.response?.headers?.["retry-after"]);
    return {
      message: "Too many requests. Please wait and try again.",
      retryAfterSeconds:
        Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0
          ? Math.ceil(parsedRetryAfter)
          : 60,
    };
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return { message: "Server error. Please try again shortly." };
  }

  if (responseMessage) {
    return {
      message: Array.isArray(responseMessage)
        ? responseMessage.join(", ")
        : responseMessage,
    };
  }

  if (status === 401) {
    return { message: "Invalid credentials" };
  }

  if (status === 404) {
    return { message: "The requested data could not be found." };
  }

  return { message: "Request failed. Please try again." };
};
