// constants
import { TABS } from "../../constants/index";

import { LayoutActionTypes, LayoutState } from "./types";
import { getStoredLayoutMode } from "../../utils/layoutMode";

export const INIT_STATE: LayoutState = {
  activeTab: TABS.CHAT,
  layoutMode: getStoredLayoutMode(),
};

const Layout = (state = INIT_STATE, action: any) => {
  switch (action.type) {
    case LayoutActionTypes.CHANGE_TAB:
      return {
        ...state,
        activeTab: action.payload,
      };

    case LayoutActionTypes.CHANGE_LAYOUT_MODE:
      return {
        ...state,
        layoutMode: action.payload.layoutMode,
      };
    default:
      return { ...state };
  }
};

export default Layout;
