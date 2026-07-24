import React, { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "reactstrap";
import { getCurrentUserId } from "../api/backendAdapters";
import { getContacts, getUserProfile, inviteContact } from "../api/contacts";

interface UserProfileModalProps {
  isOpen: boolean;
  userId: string | null;
  initialUser?: any;
  onClose: () => void;
}

const UserProfileModal = ({
  isOpen,
  userId,
  initialUser,
  onClose,
}: UserProfileModalProps) => {
  const [user, setUser] = useState<any>(initialUser || null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isContact, setIsContact] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isOpen || !userId) {
      return;
    }

    let active = true;
    setUser(initialUser?.id === userId ? initialUser : null);
    setError("");
    setSuccess("");
    setIsContact(false);
    setLoading(true);

    Promise.all([getUserProfile(userId), getContacts()])
      .then(([profile, contacts]) => {
        if (active) {
          setUser(profile);
          setIsContact(
            contacts.some((contact: any) => contact.id === profile.id),
          );
        }
      })
      .catch(reason => {
        if (active) {
          setError(String(reason || "User profile could not be loaded."));
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
  }, [initialUser, isOpen, userId]);

  const sendInvitation = async () => {
    if (!user?.email) {
      return;
    }

    try {
      setSending(true);
      setError("");
      await inviteContact({
        email: user.email,
        message: "I would like to add you as a contact on ellO.",
      });
      setSuccess("Contact invitation sent.");
    } catch (reason) {
      const message = String(reason || "Contact invitation could not be sent.");

      if (message === "Users are already contacts") {
        setIsContact(true);
      } else {
        setError(message);
      }
    } finally {
      setSending(false);
    }
  };

  const initials = (user?.username || "U").slice(0, 2).toUpperCase();
  const canInvite =
    user &&
    user.id !== getCurrentUserId() &&
    !user.isBot &&
    !loading &&
    !isContact &&
    success.length === 0;

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered>
      <ModalHeader toggle={onClose}>User profile</ModalHeader>
      <ModalBody>
        {error && <Alert color="danger">{error}</Alert>}
        {success && <Alert color="success">{success}</Alert>}
        {loading && !user ? (
          <div className="text-center p-5">
            <Spinner />
          </div>
        ) : user ? (
          <div className="text-center">
            <div className="d-flex justify-content-center mb-3">
              {user.profileImage ? (
                <img
                  src={user.profileImage}
                  alt={`${user.username} profile`}
                  className="avatar-lg rounded-circle img-thumbnail"
                />
              ) : (
                <span className="avatar-lg rounded-circle avatar-title bg-primary text-white font-size-24">
                  {initials}
                </span>
              )}
            </div>
            <h5 className="mb-1">{user.username}</h5>
            <Badge color={user.role === "admin" ? "success" : "secondary"}>
              {user.role === "admin" ? "Admin" : "User"}
            </Badge>
            <div className="text-start border-top mt-4 pt-3">
              <p className="mb-2">
                <i className="bx bx-envelope text-muted me-2"></i>
                {user.email}
              </p>
              <p className="mb-2">
                <i className="bx bx-map text-muted me-2"></i>
                {user.location || "Location not specified"}
              </p>
              <p className="mb-0">
                <i className="bx bx-info-circle text-muted me-2"></i>
                {user.about || "No profile note yet."}
              </p>
            </div>
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button type="button" color="light" onClick={onClose}>
          Close
        </Button>
        {isContact && user && user.id !== getCurrentUserId() && !user.isBot && (
          <Button type="button" color="success" outline disabled>
            <i className="bx bx-check me-2" aria-hidden="true"></i>
            Already a contact
          </Button>
        )}
        {canInvite && (
          <Button
            type="button"
            color="primary"
            disabled={sending}
            onClick={sendInvitation}
          >
            {sending ? (
              <Spinner size="sm" className="me-2" />
            ) : (
              <i className="bx bx-user-plus me-2" aria-hidden="true"></i>
            )}
            Add contact
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default UserProfileModal;
