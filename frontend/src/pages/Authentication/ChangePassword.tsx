import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Row, Col, Form } from "reactstrap";

// hooks
import { useRedux } from "../../hooks/index";
import { createSelector } from "reselect";
// validations
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useForm } from "react-hook-form";

// // hooks
// import { useProfile } from "../../hooks";

//actions
import { userChangePassword } from "../../redux/actions";

// components
import NonAuthLayoutWrapper from "../../components/NonAutnLayoutWrapper";
import AuthHeader from "../../components/AuthHeader";
import FormInput from "../../components/FormInput";
import Loader from "../../components/Loader";

import { getCurrentAuthUser } from "../../api/backendAdapters";

interface ChangePasswordProps {}
const ChangePassword = (props: ChangePasswordProps) => {
  const { t } = useTranslation();
  // global store
  const { dispatch, useAppSelector } = useRedux();

  // const { changepasswordError, passwordChanged, changePassLoading } =
  //   useAppSelector(state => ({
  //     passwordChanged: state.ForgetPassword.passwordChanged,
  //     changepasswordError: state.ForgetPassword.changepasswordError,
  //     changePassLoading: state.ForgetPassword.loading,
  //   }));

  const errorData = createSelector(
    (state: any) => state.ForgetPassword,
    state => ({
      passwordChanged: state.passwordChanged,
      changepasswordError: state.changepasswordError,
      changePassLoading: state.loading,
    }),
  );
  // Inside your component
  const { passwordChanged, changepasswordError, changePassLoading } =
    useAppSelector(errorData);

  const resolver = yupResolver(
    yup.object().shape({
      oldPassword: yup.string().required(t("auth.oldPasswordRequired")),
      password: yup.string().required(t("auth.newPasswordRequired")),
      confirmpassword: yup
        .string()
        .oneOf([yup.ref("password")], t("auth.passwordsMismatch"))
        .required(t("auth.valueRequired")),
    }),
  );

  const defaultValues: any = {};

  const methods = useForm({ defaultValues, resolver });
  const {
    handleSubmit,
    register,
    control,
    formState: { errors },
  } = methods;

  const onSubmitForm = (values: object) => {
    dispatch(userChangePassword(values));
  };

  const currentUser = getCurrentAuthUser();
  const username = currentUser?.username || t("auth.elloUser");
  const initials = username.slice(0, 2).toUpperCase();

  // const { userProfile, loading } = useProfile();

  return (
    <NonAuthLayoutWrapper>
      <Row className=" justify-content-center my-auto">
        <Col sm={8} lg={6} xl={5} className="col-xxl-4">
          <div className="py-md-5 py-4">
            <AuthHeader title={t("auth.changePassword")} />
            <div className="user-thumb text-center mb-4">
              {currentUser?.profileImage ? (
                <img
                  src={currentUser.profileImage}
                  className="rounded-circle img-thumbnail avatar-lg"
                  alt={t("profile.profileImage", { name: username })}
                />
              ) : (
                <span className="avatar-lg rounded-circle img-thumbnail avatar-title bg-primary text-white mx-auto">
                  {initials}
                </span>
              )}
              <h5 className="font-size-15 mt-3">{username}</h5>
            </div>
            {changepasswordError && changepasswordError ? (
              <Alert color="danger">{changepasswordError}</Alert>
            ) : null}
            {passwordChanged ? (
              <Alert color="success">{t("auth.passwordChanged")}</Alert>
            ) : null}

            <Form
              onSubmit={handleSubmit(onSubmitForm)}
              className="position-relative"
            >
              {changePassLoading && <Loader />}
              <div className="mb-3">
                <FormInput
                  label={t("auth.oldPassword")}
                  type="password"
                  name="oldPassword"
                  register={register}
                  errors={errors}
                  control={control}
                  labelClassName="form-label"
                  placeholder={t("auth.enterOldPassword")}
                  className="form-control"
                  withoutLabel={true}
                  hidePasswordButton={true}
                />
              </div>
              <div className="mb-3">
                <FormInput
                  label={t("auth.newPassword")}
                  type="password"
                  name="password"
                  register={register}
                  errors={errors}
                  control={control}
                  labelClassName="form-label"
                  placeholder={t("auth.enterNewPassword")}
                  className="form-control"
                  withoutLabel={true}
                  hidePasswordButton={false}
                />
              </div>
              <div className="mb-3">
                <FormInput
                  label={t("auth.confirmNewPassword")}
                  type="password"
                  name="confirmpassword"
                  register={register}
                  errors={errors}
                  control={control}
                  labelClassName="form-label"
                  placeholder={t("auth.enterConfirmPassword")}
                  className="form-control"
                  withoutLabel={true}
                  hidePasswordButton={true}
                />
              </div>

              <div className="text-center mt-4">
                <div className="row">
                  <div className="col-6">
                    <button className="btn btn-primary w-100" type="submit">
                      {t("common.save")}
                    </button>
                  </div>
                  <div className="col-6">
                    <button className="btn btn-light w-100" type="button">
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              </div>
            </Form>
          </div>
        </Col>
      </Row>
    </NonAuthLayoutWrapper>
  );
};

export default ChangePassword;
