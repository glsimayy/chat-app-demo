import React from "react";
import { useTranslation } from "react-i18next";
import { Row, Col, Form, Button } from "reactstrap";

// router
import { Link } from "react-router-dom";

// validations
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useForm } from "react-hook-form";

// hooks
// import { useProfile } from "../../hooks";

// components
import NonAuthLayoutWrapper from "../../components/NonAutnLayoutWrapper";
import AuthHeader from "../../components/AuthHeader";
import FormInput from "../../components/FormInput";

// images
import avatar1 from "../../assets/images/users/avatar-1.jpg";
import { getCurrentAuthUser } from "../../api/backendAdapters";

interface LockScreenProps {}
const LockScreen = (props: LockScreenProps) => {
  const { t } = useTranslation();
  const currentUser = getCurrentAuthUser();
  const username = currentUser?.username || t("profile.user");
  const resolver = yupResolver(
    yup.object().shape({
      password: yup.string().required(t("auth.validation.passwordRequired")),
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
    // console.log(values);
  };

  // const { userProfile, loading } = useProfile();

  return (
    <NonAuthLayoutWrapper>
      <Row className=" justify-content-center my-auto">
        <Col sm={8} lg={6} xl={5} className="col-xxl-4">
          <div className="py-md-5 py-4">
            <AuthHeader
              title={t("auth.lockScreen")}
              subtitle={t("auth.lockSubtitle")}
            />
            <div className="user-thumb text-center mb-4">
              <img
                src={currentUser?.profileImage || avatar1}
                className="rounded-circle img-thumbnail avatar-lg"
                alt={t("profile.profileImage", { name: username })}
              />
              <h5 className="font-size-15 mt-3">{username}</h5>
            </div>

            <Form
              onSubmit={handleSubmit(onSubmitForm)}
              className="position-relative"
            >
              <div className="mb-3">
                <FormInput
                  label={t("auth.password")}
                  type="password"
                  name="password"
                  register={register}
                  errors={errors}
                  control={control}
                  labelClassName="form-label"
                  placeholder={t("auth.enterPassword")}
                  className="form-control"
                  withoutLabel={true}
                  hidePasswordButton={true}
                />
              </div>
              <div className="text-center mt-4">
                <Button color="primary" className="w-100" type="submit">
                  {t("auth.unlock")}
                </Button>
              </div>
            </Form>
            <div className="mt-5 text-center text-muted">
              <p>
                {t("auth.notYou")}{" "}
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

export default LockScreen;
