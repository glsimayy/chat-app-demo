import React, { useEffect, useState } from "react";
import { Alert, Row, Col, Form, Label, Button } from "reactstrap";

// router
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

// validations
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useForm } from "react-hook-form";

// hooks
import { useProfile, useRedux } from "../../hooks/index";
import { createSelector } from "reselect";
//actions
import { clearLoginError, loginUser } from "../../redux/actions";

// components
import NonAuthLayoutWrapper from "../../components/NonAutnLayoutWrapper";
import AuthHeader from "../../components/AuthHeader";
import FormInput from "../../components/FormInput";
import Loader from "../../components/Loader";
import { useTranslation } from "react-i18next";

interface LoginProps {}
const Login = (props: LoginProps) => {
  const { t } = useTranslation();
  // global store
  const { dispatch, useAppSelector } = useRedux();

  // const { isUserLogin, error, loginLoading, isUserLogout } = useAppSelector(
  //   state => ({
  //     isUserLogin: state.Login.isUserLogin,
  //     error: state.Login.error,
  //     loginLoading: state.Login.loading,
  //     isUserLogout: state.Login.isUserLogout,
  //   })
  // );

  const errorData = createSelector(
    (state: any) => state.Login,
    state => ({
      isUserLogin: state.isUserLogin,
      error: state.error,
      loginLoading: state.loading,
      isUserLogout: state.isUserLogout,
      retryAfterUntil: state.retryAfterUntil,
    }),
  );
  // Inside your component
  const { isUserLogin, error, loginLoading, isUserLogout, retryAfterUntil } =
    useAppSelector(errorData);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const retryAfterSeconds = retryAfterUntil
    ? Math.max(0, Math.ceil((retryAfterUntil - currentTime) / 1000))
    : 0;

  const navigate = useNavigate();
  const location = useLocation();
  const [redirectUrl, setRedirectUrl] = useState("/dashboard");
  useEffect(() => {
    const url =
      location.state && location.state.from
        ? location.state.from.pathname
        : "/dashboard";
    setRedirectUrl(url);
  }, [location]);
  useEffect(() => {
    if (isUserLogin && !loginLoading && !isUserLogout) {
      navigate(redirectUrl);
    }
  }, [isUserLogin, navigate, loginLoading, isUserLogout, redirectUrl]);

  useEffect(() => {
    if (!retryAfterUntil) {
      return;
    }

    setCurrentTime(Date.now());
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAfterUntil]);

  useEffect(() => {
    if (retryAfterUntil && retryAfterSeconds === 0) {
      dispatch(clearLoginError());
    }
  }, [dispatch, retryAfterSeconds, retryAfterUntil]);

  const resolver = yupResolver(
    yup.object().shape({
      email: yup
        .string()
        .email(t("auth.validation.validEmail"))
        .required(t("auth.validation.emailRequired")),
      password: yup.string().required(t("auth.validation.passwordRequired")),
    }),
  );

  const defaultValues: any = {
    email: "",
    password: "",
  };

  const methods = useForm({ defaultValues, resolver });
  const {
    handleSubmit,
    register,
    control,
    formState: { errors },
  } = methods;

  const onSubmitForm = async (values: object) => {
    dispatch(loginUser(values));
  };

  const { userProfile, loading } = useProfile();

  if (userProfile && !loading) {
    return <Navigate to={{ pathname: redirectUrl }} />;
  }

  return (
    <NonAuthLayoutWrapper>
      <Row className=" justify-content-center my-auto">
        <Col sm={8} lg={6} xl={5} className="col-xxl-4">
          <div className="py-md-5 py-4">
            <AuthHeader
              title={t("auth.welcomeBack")}
              subtitle={t("auth.signInSubtitle")}
            />

            {error && (
              <Alert color="danger">
                {retryAfterSeconds > 0
                  ? `${error} ${t("auth.retrySentence", {
                      count: retryAfterSeconds,
                    })}`
                  : error}
              </Alert>
            )}

            <Form
              onSubmit={handleSubmit(onSubmitForm)}
              className="position-relative"
            >
              {loginLoading && <Loader />}
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

              <div className="form-check form-check-info font-size-16">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="remember-check"
                />
                <Label
                  className="form-check-label font-size-14"
                  htmlFor="remember-check"
                >
                  {t("auth.rememberMe")}
                </Label>
              </div>

              <div className="text-center mt-4">
                <Button
                  color="primary"
                  className="w-100"
                  type="submit"
                  disabled={loginLoading || retryAfterSeconds > 0}
                >
                  {retryAfterSeconds > 0
                    ? t("auth.retryIn", { count: retryAfterSeconds })
                    : t("auth.login")}
                </Button>
              </div>
            </Form>

            <div className="mt-5 text-center text-muted">
              <p>
                {t("auth.noAccount")}{" "}
                <Link
                  to="/auth-register"
                  className="fw-medium text-decoration-underline"
                >
                  {" "}
                  {t("auth.register")}
                </Link>
              </p>
            </div>
          </div>
        </Col>
      </Row>
    </NonAuthLayoutWrapper>
  );
};

export default Login;
