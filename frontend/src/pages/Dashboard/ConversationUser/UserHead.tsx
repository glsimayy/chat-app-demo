import React, { useState } from "react";
import classnames from "classnames";
import { Link } from "react-router-dom";
import { Col, Row } from "reactstrap";
import { STATUS_TYPES } from "../../../constants";
import { useRedux } from "../../../hooks";
import { changeSelectedChat } from "../../../redux/actions";

interface UserHeadProps {
  chatUserDetails: any;
  onOpenUserDetails: () => void;
  isChannel: boolean;
}

const UserHead = ({
  chatUserDetails,
  onOpenUserDetails,
  isChannel,
}: UserHeadProps) => {
  const { dispatch } = useRedux();
  const colors = [
    "bg-primary",
    "bg-danger",
    "bg-info",
    "bg-warning",
    "bg-secondary",
    "bg-pink",
    "bg-purple",
  ];
  const [color] = useState(Math.floor(Math.random() * colors.length));
  const fullName = isChannel
    ? chatUserDetails.name
    : chatUserDetails.firstName
      ? `${chatUserDetails.firstName} ${chatUserDetails.lastName}`
      : "Conversation";
  const shortName = isChannel
    ? "#"
    : `${chatUserDetails.firstName?.charAt(0) || "C"}${
        chatUserDetails.lastName?.charAt(0) || ""
      }`;
  const isOnline = chatUserDetails.status === STATUS_TYPES.ACTIVE;
  const memberCount = (chatUserDetails.members || []).filter(
    (member: any) => !member.leftAt,
  ).length;

  return (
    <div className="p-3 p-lg-4 user-chat-topbar">
      <Row className="align-items-center">
        <Col className="col-10">
          <div className="d-flex align-items-center">
            <div className="flex-shrink-0 d-block d-lg-none me-2">
              <Link
                to="#"
                onClick={() => dispatch(changeSelectedChat(null))}
                className="user-chat-remove text-muted font-size-24 p-2"
                aria-label="Close conversation"
              >
                <i className="bx bx-chevron-left align-middle"></i>
              </Link>
            </div>
            <div
              className={classnames(
                "flex-shrink-0 chat-user-img align-self-center me-3 ms-0",
                { online: isOnline },
              )}
            >
              {chatUserDetails.profileImage ? (
                <img
                  src={chatUserDetails.profileImage}
                  className="rounded-circle avatar-sm"
                  alt=""
                />
              ) : (
                <div className="avatar-sm align-self-center">
                  <span
                    className={classnames(
                      "avatar-title rounded-circle text-uppercase text-white",
                      colors[color],
                    )}
                  >
                    <span className="username">{shortName}</span>
                  </span>
                </div>
              )}
            </div>
            <div className="flex-grow-1 overflow-hidden">
              <h6 className="text-truncate mb-0 font-size-18">{fullName}</h6>
              <p className="text-truncate text-muted mb-0">
                <small>
                  {isChannel
                    ? `${memberCount} members`
                    : chatUserDetails.status || "offline"}
                </small>
              </p>
            </div>
          </div>
        </Col>
        <Col className="col-2 text-end">
          <button
            onClick={onOpenUserDetails}
            type="button"
            className="btn nav-btn user-profile-show"
            title="Conversation details"
            aria-label="Conversation details"
          >
            <i className="bx bxs-info-circle"></i>
          </button>
        </Col>
      </Row>
    </div>
  );
};

export default UserHead;
