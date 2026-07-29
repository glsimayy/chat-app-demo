import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "reactstrap";

// hooks
import { useRedux } from "../../../hooks/index";
import { createSelector } from "reselect";
// components
import Loader from "../../../components/Loader";
import AppSimpleBar from "../../../components/AppSimpleBar";
import MyProfile from "./MyProfile";
import UserDescription from "./UserDescription";
import Media from "../../../components/Media";
import AttachedFiles from "../../../components/AttachedFiles";

// actions
import { changeTab, getProfileDetails } from "../../../redux/actions";
import { TABS } from "../../../constants";

const Index = () => {
  const { t } = useTranslation();
  // global store
  const { dispatch, useAppSelector } = useRedux();

  const errorData = createSelector(
    (state: any) => state.Profile,
    state => ({
      profileDetails: state.profileDetails,
      getProfileLoading: state.getProfileLoading,
      isProfileFetched: state.isProfileFetched,
    }),
  );
  // Inside your component
  const { profileDetails, getProfileLoading, isProfileFetched } =
    useAppSelector(errorData);

  // get user profile details
  useEffect(() => {
    dispatch(getProfileDetails());
  }, [dispatch]);

  return (
    <div className="position-relative">
      {getProfileLoading && !isProfileFetched && <Loader />}
      {profileDetails.basicDetails && (
        <MyProfile basicDetails={profileDetails.basicDetails} />
      )}

      {profileDetails.basicDetails && (
        <AppSimpleBar className="p-4 profile-desc">
          <div className="profile-account-actions">
            <small className="text-muted d-block mb-2">
              {t("profile.account")}
            </small>
            <Button
              type="button"
              color="light"
              className="w-100 d-flex align-items-center text-start mb-2"
              onClick={() => dispatch(changeTab(TABS.SETTINGS))}
            >
              <i className="bx bx-cog font-size-18 me-3"></i>
              <span className="flex-grow-1">{t("profile.settings")}</span>
              <i className="bx bx-chevron-right"></i>
            </Button>
            <Link
              to="/auth-changepassword"
              className="btn btn-light w-100 d-flex align-items-center text-start mb-2"
            >
              <i className="bx bx-lock-open font-size-18 me-3"></i>
              <span className="flex-grow-1">{t("profile.changePassword")}</span>
              <i className="bx bx-chevron-right"></i>
            </Link>
            <Link
              to="/logout"
              className="btn btn-light text-danger w-100 d-flex align-items-center text-start"
            >
              <i className="bx bx-log-out-circle font-size-18 me-3"></i>
              <span className="flex-grow-1">{t("profile.logout")}</span>
              <i className="bx bx-chevron-right"></i>
            </Link>
          </div>
          <hr className="my-4" />
          <UserDescription basicDetails={profileDetails.basicDetails} />
          {profileDetails.media?.total > 0 && (
            <>
              <hr className="my-4" />
              <Media media={profileDetails.media} limit={2} />
            </>
          )}
          {profileDetails.attachedFiles?.total > 0 && (
            <>
              <hr className="my-4" />
              <AttachedFiles attachedFiles={profileDetails.attachedFiles} />
            </>
          )}
        </AppSimpleBar>
      )}
    </div>
  );
};

export default Index;
