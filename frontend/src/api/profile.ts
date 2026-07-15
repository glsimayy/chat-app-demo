import { getCurrentAuthUser } from "./backendAdapters";
import { settings } from "../data/settings";

const getProfileDetails = () => {
  const user = getCurrentAuthUser();
  const username = user?.username || "User";

  return Promise.resolve({
    basicDetails: {
      firstName: username,
      lastName: "",
      title: user?.role === "admin" ? "Administrator" : "User",
      description: "",
      fullName: username,
      email: user?.email || "",
      location: "",
      avatar: user?.profileImage || "",
      coverImage: "",
    },
    media: { total: 0, list: [] },
    attachedFiles: { total: 0, list: [] },
  });
};

const getSettings = () => {
  return Promise.resolve(settings);
};
const updateSettings = (field: string, value: any) => {
  return Promise.resolve({ field, value });
};

export { getProfileDetails, getSettings, updateSettings };
