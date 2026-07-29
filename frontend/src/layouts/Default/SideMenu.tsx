import React, { useEffect, useState } from "react";

import { Link } from "react-router-dom";
import { Nav, NavItem, NavLink, UncontrolledTooltip } from "reactstrap";
import { createSelector } from "reselect";
// hooks
import { useRedux } from "../../hooks/index";

// actions
import { changeSelectedChat, changeTab } from "../../redux/actions";

// costants
import { TABS } from "../../constants/index";

import { getCurrentAuthUser } from "../../api/backendAdapters";

// menu
import { MENU_ITEMS, MenuItemType } from "./menu";

const LogoLightSVG = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="30"
      viewBox="0 0 24 24"
    >
      <path d="M8.5,18l3.5,4l3.5-4H19c1.103,0,2-0.897,2-2V4c0-1.103-0.897-2-2-2H5C3.897,2,3,2.897,3,4v12c0,1.103,0.897,2,2,2H8.5z M7,7h10v2H7V7z M7,11h7v2H7V11z" />
    </svg>
  );
};

const LogoDarkSVG = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="30"
      viewBox="0 0 24 24"
    >
      <path d="M8.5,18l3.5,4l3.5-4H19c1.103,0,2-0.897,2-2V4c0-1.103-0.897-2-2-2H5C3.897,2,3,2.897,3,4v12c0,1.103,0.897,2,2,2H8.5z M7,7h10v2H7V7z M7,11h7v2H7V11z" />
    </svg>
  );
};

const Logo = () => {
  return (
    <div className="navbar-brand-box">
      <Link to="/dashboard" className="logo logo-dark" aria-label="ellO home">
        <span className="logo-sm">
          <LogoLightSVG />
        </span>
      </Link>

      <Link to="/dashboard" className="logo logo-light" aria-label="ellO home">
        <span className="logo-sm">
          <LogoDarkSVG />
        </span>
      </Link>
    </div>
  );
};

interface MenuNavItemProps {
  item: MenuItemType;
  selectedTab: TABS;
  onChangeTab: (id: TABS) => void;
}
const MenuNavItem = ({ item, selectedTab, onChangeTab }: MenuNavItemProps) => {
  const onClick = () => {
    onChangeTab(item.tabId);
  };
  return (
    <>
      <NavItem className={item.className} id={`${item.key}-container`}>
        <NavLink
          href="#"
          active={selectedTab === item.tabId}
          id={item.key}
          aria-label={item.tooltipTitle}
          aria-current={selectedTab === item.tabId ? "page" : undefined}
          onClick={onClick}
        >
          <i className={item.icon}></i>
        </NavLink>
      </NavItem>
      <UncontrolledTooltip target={`${item.key}-container`} placement="right">
        {item.tooltipTitle}
      </UncontrolledTooltip>
    </>
  );
};

interface ProfileMenuButtonProps {
  onChangeTab: (id: TABS) => void;
  selectedTab: TABS;
}
const ProfileMenuButton = ({
  onChangeTab,
  selectedTab,
}: ProfileMenuButtonProps) => {
  const [profile, setProfile] = useState(() => getCurrentAuthUser());

  useEffect(() => {
    const refreshProfile = () => setProfile(getCurrentAuthUser());
    window.addEventListener("ello:profile-updated", refreshProfile);
    return () =>
      window.removeEventListener("ello:profile-updated", refreshProfile);
  }, []);

  const initials = (profile?.username || "U").slice(0, 2).toUpperCase();

  return (
    <NavItem className="profile-user-menu mt-auto" id="profile-user-menu">
      <button
        type="button"
        aria-label="Open profile menu"
        className={`nav-link bg-transparent ${
          selectedTab === TABS.USERS ? "active" : ""
        }`}
        onClick={() => onChangeTab(TABS.USERS)}
      >
        {profile?.profileImage ? (
          <img
            src={profile.profileImage}
            alt={`${profile.username} profile`}
            className="profile-user rounded-circle"
          />
        ) : (
          <span className="profile-user rounded-circle avatar-title bg-primary text-white font-size-11">
            {initials}
          </span>
        )}
      </button>
      <UncontrolledTooltip target="profile-user-menu" placement="right">
        My profile
      </UncontrolledTooltip>
    </NavItem>
  );
};

const SideMenu = () => {
  // global store
  const { dispatch, useAppSelector } = useRedux();

  const [profile, setProfile] = useState(() => getCurrentAuthUser());
  const menuItems: MenuItemType[] = MENU_ITEMS.filter(
    item => !item.adminOnly || profile?.role === "admin",
  );
  const errorData = createSelector(
    (state: any) => state.Layout,
    state => ({
      activeTab: state.activeTab,
    }),
  );
  // Inside your component
  const { activeTab } = useAppSelector(errorData);

  /* 
    tab activation
    */
  const [selectedTab, setSelectedTab] = useState<TABS>(TABS.CHAT);
  const onChangeTab = (id: TABS) => {
    setSelectedTab(id);
    dispatch(changeTab(id));
    if (id === TABS.SUPPORT || id === TABS.ADMIN) {
      dispatch(changeSelectedChat(null));
    }
  };

  useEffect(() => {
    const refreshProfile = () => setProfile(getCurrentAuthUser());
    window.addEventListener("ello:profile-updated", refreshProfile);
    return () =>
      window.removeEventListener("ello:profile-updated", refreshProfile);
  }, []);

  useEffect(() => {
    setSelectedTab(activeTab);
  }, [activeTab]);

  return (
    <div className="side-menu flex-lg-column">
      {/* LOGO */}
      <Logo />
      {/* end navbar-brand-box */}

      {/* Start side-menu nav */}
      <div className="flex-lg-column my-0 sidemenu-navigation">
        <Nav pills className="side-menu-nav" aria-label="Primary navigation">
          {(menuItems || []).map((item: MenuItemType, key: number) => (
            <MenuNavItem
              item={item}
              key={key}
              selectedTab={selectedTab}
              onChangeTab={onChangeTab}
            />
          ))}

          {/* profile menu dropdown */}
          <ProfileMenuButton
            onChangeTab={onChangeTab}
            selectedTab={selectedTab}
          />
        </Nav>
      </div>
      {/* end side-menu nav */}
    </div>
  );
};

export default SideMenu;
