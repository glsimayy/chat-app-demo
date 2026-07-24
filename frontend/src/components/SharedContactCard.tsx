import React, { useEffect, useState } from "react";
import { Button, Spinner } from "reactstrap";
import { getUserProfile } from "../api/contacts";
import UserProfileModal from "./UserProfileModal";

interface SharedContactCardProps {
  userId: string;
}

const SharedContactCard = ({ userId }: SharedContactCardProps) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getUserProfile(userId)
      .then(profile => {
        if (active) {
          setUser(profile);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const initials = (user?.username || "U").slice(0, 2).toUpperCase();

  return (
    <>
      <Button
        type="button"
        color="light"
        className="shared-contact-card text-start"
        disabled={!user}
        aria-label={
          user ? `Open ${user.username} profile` : "Shared contact unavailable"
        }
        onClick={() => setIsProfileOpen(true)}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : user?.profileImage ? (
          <img
            src={user.profileImage}
            alt=""
            className="avatar-sm rounded-circle"
          />
        ) : (
          <span className="avatar-sm rounded-circle avatar-title bg-primary text-white">
            {initials}
          </span>
        )}
        <span className="shared-contact-copy">
          <strong className="d-block text-truncate">
            {user?.username || "Contact unavailable"}
          </strong>
          <small className="d-block text-muted">
            View user profile
          </small>
        </span>
        <i className="bx bx-chevron-right font-size-20"></i>
      </Button>
      <UserProfileModal
        isOpen={isProfileOpen}
        userId={userId}
        initialUser={user}
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  );
};

export default SharedContactCard;
