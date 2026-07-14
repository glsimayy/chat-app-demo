import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spinner } from "reactstrap";

import { getCurrentUser } from "../api";
import { getLoggedinUser } from "../api/apiCore";
import { disconnectChatSocket } from "../api/realtime";

const AuthProtected = (props: any) => {
  const location = useLocation();
  const [sessionState, setSessionState] = useState<
    "checking" | "authenticated" | "unauthenticated"
  >(getLoggedinUser() ? "checking" : "unauthenticated");

  useEffect(() => {
    if (!getLoggedinUser()) {
      setSessionState("unauthenticated");
      return;
    }

    let isMounted = true;

    getCurrentUser()
      .then(() => {
        if (isMounted) {
          setSessionState("authenticated");
        }
      })
      .catch(() => {
        disconnectChatSocket();
        localStorage.removeItem("authUser");

        if (isMounted) {
          setSessionState("unauthenticated");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (sessionState === "checking") {
    return (
      <div className="d-flex min-vh-100 align-items-center justify-content-center">
        <Spinner color="primary" />
      </div>
    );
  }

  if (sessionState === "unauthenticated") {
    return <Navigate to="/auth-login" replace state={{ from: location }} />;
  }

  return <>{props.children}</>;
};

export { AuthProtected };
