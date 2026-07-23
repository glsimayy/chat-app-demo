// costants
import { TABS } from "../../constants/index";

export interface MenuItemType {
  id: number;
  key: string;
  icon: string;
  tooltipTitle: string;
  className?: string;
  tabId:
    | TABS.BOOKMARK
    | TABS.CALLS
    | TABS.CHAT
    | TABS.CONTACTS
    | TABS.SUPPORT
    | TABS.SETTINGS
    | TABS.USERS;
}
const MENU_ITEMS: MenuItemType[] = [
  {
    id: 1,
    key: "pills-chat-tab",
    icon: "bx bx-conversation",
    tooltipTitle: "Chats",
    tabId: TABS.CHAT,
  },
  {
    id: 2,
    key: "pills-contacts-tab",
    icon: "bx bxs-user-detail",
    tooltipTitle: "Contacts",
    tabId: TABS.CONTACTS,
  },
  {
    id: 3,
    key: "pills-calls-tab",
    icon: "bx bx-phone-call",
    tooltipTitle: "Calls",
    tabId: TABS.CALLS,
  },
  {
    id: 4,
    key: "pills-bookmark-tab",
    icon: "bx bx-bookmarks",
    tooltipTitle: "Bookmark",
    tabId: TABS.BOOKMARK,
  },
  {
    id: 5,
    key: "pills-support-tab",
    icon: "bx bx-support",
    tooltipTitle: "Support",
    tabId: TABS.SUPPORT,
  },
  {
    id: 6,
    key: "pills-setting-tab",
    icon: "bx bx-cog",
    tooltipTitle: "Settings",
    tabId: TABS.SETTINGS,
  },
];

export { MENU_ITEMS };
