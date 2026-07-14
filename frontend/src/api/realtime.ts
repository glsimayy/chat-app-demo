import { io, Socket } from "socket.io-client";
import config from "../config";
import { getLoggedinUser } from "./apiCore";

let chatSocket: Socket | null = null;
let activeToken: string | null = null;

const getSocketUrl = () => {
  return config.API_URL.replace(/\/api\/?$/, "") + "/chat";
};

const getToken = () => {
  const user = getLoggedinUser();
  return user?.accessToken || user?.token || null;
};

export const getChatSocket = () => {
  const token = getToken();

  if (!token) {
    return null;
  }

  if (chatSocket && activeToken === token) {
    return chatSocket;
  }

  chatSocket?.disconnect();
  activeToken = token;
  chatSocket = io(getSocketUrl(), {
    autoConnect: false,
    auth: { token },
    transports: ["websocket", "polling"],
  });

  return chatSocket;
};

export const disconnectChatSocket = () => {
  chatSocket?.disconnect();
  chatSocket = null;
  activeToken = null;
};
