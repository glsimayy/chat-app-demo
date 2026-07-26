import { LAYOUT_MODES } from "../constants";

export const LAYOUT_MODE_STORAGE_KEY = "ello-layout-mode";

export const getStoredLayoutMode = ():
  LAYOUT_MODES.LIGHT | LAYOUT_MODES.DARK => {
  if (typeof window === "undefined") {
    return LAYOUT_MODES.LIGHT;
  }

  try {
    const storedMode = window.localStorage.getItem(LAYOUT_MODE_STORAGE_KEY);
    return storedMode === LAYOUT_MODES.DARK
      ? LAYOUT_MODES.DARK
      : LAYOUT_MODES.LIGHT;
  } catch {
    return LAYOUT_MODES.LIGHT;
  }
};

export const storeLayoutMode = (
  layoutMode: LAYOUT_MODES.LIGHT | LAYOUT_MODES.DARK,
) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, layoutMode);
  } catch {
    // The selected mode still applies for this session when storage is blocked.
  }
};
