import { APIClient } from "./apiCore";
import { getCurrentUserId, mapContact } from "./backendAdapters";

const api = new APIClient();

const getContacts = (filters?: object) => {
  return api.get("/users", filters).then((users: any) => {
    const currentUserId = getCurrentUserId();
    const userList = Array.isArray(users) ? users : users?.items || [];

    return userList
      .filter((user: any) => user.id !== currentUserId && !user.isBot)
      .map(mapContact);
  });
};

const inviteContact = (data: object) => {
  return Promise.resolve("User list refreshed");
};
export { getContacts, inviteContact };
