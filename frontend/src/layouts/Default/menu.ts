// costants
import { TABS } from "../../constants/index";

export interface MenuItemType {
  id: number;
  key: string;
  icon: string;
  labelKey: string;
  className?: string;
  tabId: TABS;
  adminOnly?: boolean;
}
const MENU_ITEMS: MenuItemType[] = [
  {
    id: 1,
    key: "pills-chat-tab",
    icon: "bx bx-conversation",
    labelKey: "nav.chats",
    tabId: TABS.CHAT,
  },
  {
    id: 2,
    key: "pills-contacts-tab",
    icon: "bx bxs-user-detail",
    labelKey: "nav.contacts",
    tabId: TABS.CONTACTS,
  },
  {
    id: 3,
    key: "pills-calls-tab",
    icon: "bx bx-phone-call",
    labelKey: "nav.calls",
    tabId: TABS.CALLS,
  },
  {
    id: 4,
    key: "pills-bookmark-tab",
    icon: "bx bx-bookmarks",
    labelKey: "nav.savedMessages",
    tabId: TABS.BOOKMARK,
  },
  {
    id: 5,
    key: "pills-support-tab",
    icon: "bx bx-support",
    labelKey: "nav.support",
    tabId: TABS.SUPPORT,
  },
  {
    id: 6,
    key: "pills-admin-tab",
    icon: "bx bx-shield-quarter",
    labelKey: "nav.admin",
    tabId: TABS.ADMIN,
    adminOnly: true,
  },
  {
    id: 7,
    key: "pills-setting-tab",
    icon: "bx bx-cog",
    labelKey: "nav.settings",
    tabId: TABS.SETTINGS,
  },
];

export { MENU_ITEMS };
