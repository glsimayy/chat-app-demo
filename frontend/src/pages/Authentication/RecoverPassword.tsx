import React from "react";
import { Alert, Row, Col, Form, Button } from "reactstrap";

// hooks
import { useRedux } from "../../hooks/index";

// router
import { Link, Navigate } from "react-router-dom";

// validations
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useForm } from "react-hook-form";

// hooks
import { useProfile } from "../../hooks";

//actions
import { userForgetPassword } from "../../redux/actions";

// components
import NonAuthLayoutWrapper from "../../components/NonAutnLayoutWrapper";
import AuthHeader from "../../components/AuthHeader";
import FormInput from "../../components/FormInput";
import Loader from "../../components/Loader";
import { createSelector } from "reselect";
import { useTranslation } from "react-i18next";
interface RecoverPasswordProps {}
const RecoverPassword = (props: RecoverPasswordProps) => {
  const { t } = useTranslation();
  // global store
  const { dispatch, useAppSelector } = useRedux();

  // const { forgetError, forgetSuccessMsg, forgetPassLoading } = useAppSelector(
  //   state => ({
  //     forgetError: state.ForgetPassword.forgetError,
  //     forgetSuccessMsg: state.ForgetPassword.forgetSuccessMsg,
  //     forgetPassLoading: state.ForgetPassword.loading,
  //   })
  // );

  const errorData = createSelector(
    (state: any) => state.ForgetPassword,
    state => ({
      forgetError: state.forgetError,
      forgetSuccessMsg: state.forgetSuccessMsg,
      forgetPassLoading: state.loading,
    }),
  );
  // Inside your component
  const { forgetError, forgetSuccessMsg, forgetPassLoading } =
    useAppSelector(errorData);

  const resolver = yupResolver(
    yup.object().shape({
      email: yup
        .string()
        .email(t("auth.validation.validEmail"))
        .required(t("auth.validation.emailRequired")),
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
    dispatch(userForgetPassword(values));
  };

  const { userProfile, loading } = useProfile();
  if (userProfile && !loading) {
    return <Navigate to={{ pathname: "/dashboard" }} />;
  }

  return (
    <NonAuthLayoutWrapper>
      <Row className=" justify-content-center my-auto">
        <Col sm={8} lg={6} xl={5} className="col-xxl-4">
          <div className="py-md-5 py-4">
            <AuthHeader
              title={t("auth.resetTitle")}
              subtitle={t("auth.resetSubtitle")}
            />

            {forgetError && forgetError ? (
              <Alert color="danger">{forgetError}</Alert>
            ) : null}
            {forgetSuccessMsg ? (
              <Alert color="success">{forgetSuccessMsg}</Alert>
            ) : null}
            {!forgetError && !forgetSuccessMsg && (
              <Alert color="info" className="text-center my-4">
                {t("auth.resetInfo")}
              </Alert>
            )}

            <Form
              onSubmit={handleSubmit(onSubmitForm)}
              className="position-relative"
            >
              {forgetPassLoading && <Loader />}
              <div className="mb-3">
                <FormInput
                  label={t("auth.email")}
                  type="text"
                  name="email"
                  register={register}
                  errors={errors}
                  control={control}
                  labelClassName="form-label"
                  placeholder={t("auth.enterEmail")}
                  className="form-control"
                />
              </div>
              <div className="text-center mt-4">
                <Button color="primary" className="w-100" type="submit">
                  {t("auth.reset")}
                </Button>
              </div>
            </Form>
            <div className="mt-5 text-center text-muted">
              <p>
                {t("auth.rememberPassword")}{" "}
                <Link
                  to="/auth-login"
                  className="fw-medium text-decoration-underline"
                >
                  {" "}
                  {t("auth.login")}
                </Link>
              </p>
            </div>
          </div>
        </Col>
      </Row>
    </NonAuthLayoutWrapper>
  );
};

export default RecoverPassword;
