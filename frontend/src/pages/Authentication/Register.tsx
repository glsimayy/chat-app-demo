import React from "react";
import { Alert, Row, Col, Form, Button, UncontrolledTooltip } from "reactstrap";

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
import { createSelector } from "reselect";
//actions
import { registerUser } from "../../redux/actions";

// components
import NonAuthLayoutWrapper from "../../components/NonAutnLayoutWrapper";
import AuthHeader from "../../components/AuthHeader";
import FormInput from "../../components/FormInput";
import Loader from "../../components/Loader";
import { useTranslation } from "react-i18next";

interface RegisterProps {}
const Register = (props: RegisterProps) => {
  const { t } = useTranslation();
  // global store
  const { dispatch, useAppSelector } = useRedux();

  // const { user, registrationError, regLoading } = useAppSelector(state => ({
  //   user: state.Register.user,
  //   registrationError: state.Register.registrationError,
  //   regLoading: state.Register.loading,
  //   isUserRegistered: state.Register.isUserRegistered,
  // }));

  const errorData = createSelector(
    (state: any) => state.Register,
    state => ({
      user: state.user,
      registrationError: state.registrationError,
      regLoading: state.loading,
      isUserRegistered: state.isUserRegistered,
    }),
  );
  // Inside your component
  const { user, registrationError, regLoading } = useAppSelector(errorData);

  const resolver = yupResolver(
    yup.object().shape({
      email: yup
        .string()
        .email(t("auth.validation.validEmail"))
        .required(t("auth.validation.emailRequired")),
      username: yup
        .string()
        .min(3, t("auth.validation.usernameMin"))
        .matches(/^[a-zA-Z0-9_]+$/, t("auth.validation.usernamePattern"))
        .required(t("auth.validation.usernameRequired")),
      password: yup
        .string()
        .min(6, t("auth.validation.passwordMin"))
        .required(t("auth.validation.passwordRequired")),
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
    dispatch(registerUser(values));
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
              title={t("auth.registerTitle")}
              subtitle={t("auth.registerSubtitle")}
            />

            {user && user ? (
              <Alert color="success">{t("auth.registerSuccess")}</Alert>
            ) : null}

            {registrationError && registrationError ? (
              <Alert color="danger">{registrationError}</Alert>
            ) : null}

            <Form
              onSubmit={handleSubmit(onSubmitForm)}
              className="position-relative"
            >
              {regLoading && <Loader />}
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

              <div className="mb-3">
                <FormInput
                  label={t("auth.username")}
                  type="text"
                  name="username"
                  register={register}
                  errors={errors}
                  control={control}
                  labelClassName="form-label"
                  placeholder={t("auth.enterUsername")}
                  className="form-control"
                />
              </div>

              <div className="mb-3">
                <FormInput
                  label={t("auth.password")}
                  type="password"
                  name="password"
                  register={register}
                  errors={errors}
                  control={control}
                  labelClassName="form-label"
                  className="form-control pe-5"
                  placeholder={t("auth.enterPassword")}
                />
              </div>

              <div className="mb-4">
                <p className="mb-0">
                  {t("auth.termsPrefix")}{" "}
                  <Link to="#" className="text-primary">
                    {t("auth.terms")}
                  </Link>
                </p>
              </div>

              <div className="text-center mb-3">
                <Button
                  color="primary"
                  className="w-100  waves-effect waves-light"
                  type="submit"
                >
                  {t("auth.register")}
                </Button>
              </div>
              <div className="mt-4 text-center">
                <div className="signin-other-title">
                  <h5 className="font-size-14 mb-4 title">
                    {t("auth.signUpUsing")}
                  </h5>
                </div>
                <Row className="">
                  <div className="col-4">
                    <div>
                      <button
                        type="button"
                        className="btn btn-light w-100"
                        id="facebook"
                      >
                        <i className="mdi mdi-facebook text-indigo"></i>
                      </button>
                    </div>
                    <UncontrolledTooltip placement="top" target="facebook">
                      Facebook
                    </UncontrolledTooltip>
                  </div>
                  <div className="col-4">
                    <div>
                      <button
                        type="button"
                        className="btn btn-light w-100"
                        id="twitter"
                      >
                        <i className="mdi mdi-twitter text-info"></i>
                      </button>
                    </div>
                    <UncontrolledTooltip placement="top" target="twitter">
                      Twitter
                    </UncontrolledTooltip>
                  </div>
                  <div className="col-4">
                    <div>
                      <button
                        type="button"
                        className="btn btn-light w-100"
                        id="google"
                      >
                        <i className="mdi mdi-google text-danger"></i>
                      </button>
                    </div>
                    <UncontrolledTooltip placement="top" target="google">
                      Google
                    </UncontrolledTooltip>
                  </div>
                </Row>
              </div>
            </Form>

            <div className="mt-5 text-center text-muted">
              <p>
                {t("auth.haveAccount")}{" "}
                <Link
                  to="/auth-login"
                  className="fw-medium text-decoration-underline"
                >
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

export default Register;
