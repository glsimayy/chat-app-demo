const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000/api";

const config = {
  API_URL,
  SOCKET_URL:
    process.env.REACT_APP_SOCKET_URL ||
    API_URL.replace(/\/api\/?$/, "") + "/chat",
};

export default config;
