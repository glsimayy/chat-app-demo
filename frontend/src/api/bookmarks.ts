import { APIClient } from "./apiCore";

const api = new APIClient();

const getBookmarks = () => api.get("/bookmarks");

const createBookmark = (messageId: string, title?: string) =>
  api.create("/bookmarks", { messageId, title });

const deleteBookmark = (messageId: string) =>
  api.delete(`/bookmarks/${messageId}`);

const updateBookmark = (messageId: string, data: { title?: string }) =>
  api.patch(`/bookmarks/${messageId}`, data);

export { createBookmark, deleteBookmark, getBookmarks, updateBookmark };
