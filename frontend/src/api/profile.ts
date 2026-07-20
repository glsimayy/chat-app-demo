import { APIClient } from "./apiCore";
import { getCurrentAuthUser } from "./backendAdapters";
import { settings } from "../data/settings";

const api = new APIClient();

const syncAuthUser = (user: any) => {
  const current = getCurrentAuthUser();
  const nextUser = { ...current, ...user };
  localStorage.setItem("authUser", JSON.stringify(nextUser));
  window.dispatchEvent(
    new CustomEvent("ello:profile-updated", { detail: nextUser }),
  );
  return nextUser;
};

const getMyProfile = () => api.get("/users/me");

const updateMyProfile = (updates: Record<string, unknown>) =>
  api.patch("/users/me", updates).then(syncAuthUser);

const toBasicDetails = (user: any) => {
  const username = user?.username || "User";

  return {
    username,
    role: user?.role || "user",
    about: user?.about || "",
    firstName: username,
    lastName: "",
    title: user?.role === "admin" ? "Administrator" : "Member",
    description: user?.about || "",
    fullName: username,
    email: user?.email || "",
    location: user?.location || "",
    avatar: user?.profileImage || "",
    profile: user?.profileImage || "",
    coverImage: "",
  };
};

const getProfileDetails = async () => {
  const user = await getMyProfile();

  return {
    basicDetails: {
      ...toBasicDetails(user),
    },
    media: { total: 0, list: [] },
    attachedFiles: { total: 0, list: [] },
  };
};

const getSettings = async () => {
  const user = await getMyProfile();
  return {
    ...settings,
    basicDetails: toBasicDetails(user),
  };
};
const updateSettings = (field: string, value: any) => {
  return Promise.resolve({ field, value });
};

export {
  getMyProfile,
  getProfileDetails,
  getSettings,
  updateMyProfile,
  updateSettings,
};
