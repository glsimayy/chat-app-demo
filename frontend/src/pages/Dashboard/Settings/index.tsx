import React, { useState, useEffect } from "react";
import { Button, Collapse } from "reactstrap";
import classnames from "classnames";
import { createSelector } from "reselect";
// hooks
import { useRedux } from "../../../hooks/index";

// actions
import {
  getProfileDetails,
  getSettings,
  updateSettings,
} from "../../../redux/actions";
import { getSettings as getSettingsApi, updateMyProfile } from "../../../api";
import { compressProfileImage } from "../../../utils/profileImage";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../helpers/notifications";

// constants
import { SETTINGS_COLLAPSES } from "../../../constants";

// interface
import { SettingsTypes } from "../../../data/settings";

// components
import Loader from "../../../components/Loader";
import AppSimpleBar from "../../../components/AppSimpleBar";
import UserCoverImage from "./UserCoverImage";
import UserProfile from "./UserProfile";
import PersonalInfo from "./PersonalInfo";
import ThemeSettings from "./ThemeSettings";
import Privacy from "./Privacy";
import Security from "./Security";
import Help from "./Help";
import LanguageSettings from "./LanguageSettings";
import { useTranslation } from "react-i18next";

interface CollapseItemTypes {
  value: SETTINGS_COLLAPSES;
  label: string;
  icon: string;
  component: any;
}

interface AccordianItemProps {
  item: CollapseItemTypes;
  onChange: (id: SETTINGS_COLLAPSES | null) => void;
  selectedMenu: SETTINGS_COLLAPSES | null;
}
const AccordianItem = ({
  item,
  selectedMenu,
  onChange,
}: AccordianItemProps) => {
  const isOpen: boolean =
    selectedMenu && selectedMenu === item.value ? true : false;
  const toggleCollapse = () => {
    if (isOpen) {
      onChange(null);
    } else {
      onChange(item.value);
    }
  };
  return (
    <div className="accordion-item">
      <div className="accordion-header" id="headerpersonalinfo">
        <Button
          color="none"
          className={classnames(
            "accordion-button",
            "font-size-14",
            "fw-medium",
            { collapsed: !isOpen },
          )}
          onClick={toggleCollapse}
          type="button"
          aria-label={item.label}
        >
          <i className={classnames("text-muted", "me-3", item.icon)}></i>{" "}
          {item.label}
        </Button>
      </div>
      <Collapse
        isOpen={isOpen}
        id="personalinfo"
        className="accordion-collapse"
      >
        {item.component}
      </Collapse>
    </div>
  );
};
interface IndexProps {}
const Index = (props: IndexProps) => {
  const { t } = useTranslation();
  // global store
  const { dispatch, useAppSelector } = useRedux();

  const errorData = createSelector(
    (state: any) => state.Settings,
    (state: any) => state.Profile,
    state => ({
      settingsData: state.settings,
      getSettingsLoading: state.getSettingsLoading,
      isSettingsFetched: state.isSettingsFetched,
    }),
  );
  // Inside your component
  const { settingsData, getSettingsLoading } = useAppSelector(errorData);

  // get user settings
  useEffect(() => {
    dispatch(getSettings());
  }, [dispatch]);

  const [settings, setSettings] = useState<SettingsTypes | null>(null);
  useEffect(() => {
    if (settingsData?.basicDetails) {
      setSettings(settingsData);
    }
  }, [settingsData]);

  const saveProfile = async (updates: Record<string, unknown>) => {
    try {
      await updateMyProfile(updates);
      const nextSettings = await getSettingsApi();
      setSettings(nextSettings);
      dispatch(getProfileDetails());
      showSuccessNotification(t("settings.profileUpdated"));
      return true;
    } catch (error: any) {
      showErrorNotification(String(error || t("settings.profileUpdateFailed")));
      return false;
    }
  };

  const updateProfileImage = async (file: File) => {
    try {
      const profileImage = await compressProfileImage(file);
      await saveProfile({ profileImage });
    } catch (error: any) {
      showErrorNotification(String(error || t("settings.profileImageFailed")));
    }
  };

  /*
  api calling
  */
  const onChangeData = (field: string, value: any) => {
    dispatch(updateSettings(field, value));
  };

  /*
  collapse handeling
  */
  const [selectedMenu, setSelectedMenu] = useState<SETTINGS_COLLAPSES | null>(
    null,
  );

  const collapseItems: CollapseItemTypes[] = settings
    ? [
        {
          value: SETTINGS_COLLAPSES.PROFILE,
          label: t("settings.personalInfo"),
          icon: "bx bxs-user",
          component: (
            <PersonalInfo
              basicDetails={settings.basicDetails}
              onSave={saveProfile}
            />
          ),
        },
        {
          value: SETTINGS_COLLAPSES.LANGUAGE,
          label: t("settings.language"),
          icon: "bx bx-globe",
          component: <LanguageSettings />,
        },
        {
          value: SETTINGS_COLLAPSES.THEME,
          label: t("settings.themes"),
          icon: "bx bxs-adjust-alt",
          component: (
            <ThemeSettings theme={settings.theme} onChangeData={onChangeData} />
          ),
        },
        {
          value: SETTINGS_COLLAPSES.PRIVACY,
          label: t("settings.privacy"),
          icon: "bx bxs-lock",
          component: (
            <Privacy
              privacy={settings.privacy}
              onChangeSettings={onChangeData}
            />
          ),
        },
        {
          value: SETTINGS_COLLAPSES.SECURITY,
          label: t("settings.security"),
          icon: "bx bxs-check-shield",
          component: (
            <Security
              security={settings.security}
              onChangeSettings={onChangeData}
            />
          ),
        },
        {
          value: SETTINGS_COLLAPSES.HELP,
          label: t("settings.help"),
          icon: "bx bxs-help-circle",
          component: <Help />,
        },
      ]
    : [];

  const onChangeCollapse = (id: SETTINGS_COLLAPSES | null) => {
    setSelectedMenu(id);
  };

  return (
    <div className="position-relative">
      {(getSettingsLoading || !settings) && <Loader />}
      <UserCoverImage />

      {settings && (
        <UserProfile
          basicDetails={settings.basicDetails}
          onProfileImageChange={updateProfileImage}
        />
      )}
      {/* Start User profile description */}
      <AppSimpleBar className="user-setting">
        <div id="settingprofile" className="accordion accordion-flush">
          {(collapseItems || []).map((item: CollapseItemTypes, key: number) => (
            <AccordianItem
              item={item}
              key={key}
              selectedMenu={selectedMenu}
              onChange={onChangeCollapse}
            />
          ))}
        </div>
        {/* end profile-setting-accordion */}
      </AppSimpleBar>
    </div>
  );
};

export default Index;
