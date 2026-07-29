import React from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal, ModalBody, ModalHeader, Spinner } from "reactstrap";
import { ContactInvitation } from "../api/contacts";

interface ContactInvitationsModalProps {
  isOpen: boolean;
  invitations: ContactInvitation[];
  processingId: string | null;
  onClose: () => void;
  onRespond: (invitationId: string, status: "accepted" | "declined") => void;
}

const ContactInvitationsModal = ({
  isOpen,
  invitations,
  processingId,
  onClose,
  onRespond,
}: ContactInvitationsModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered scrollable>
      <ModalHeader toggle={onClose}>{t("contacts.invitations")}</ModalHeader>
      <ModalBody className="p-0">
        {invitations.length === 0 ? (
          <div className="text-center text-muted p-4">
            <i className="bx bx-envelope-open font-size-24 d-block mb-2"></i>
            {t("contacts.noPendingInvitations")}
          </div>
        ) : (
          <ul className="list-group list-group-flush">
            {invitations.map(invitation => {
              const busy = processingId === invitation.id;
              return (
                <li className="list-group-item p-3" key={invitation.id}>
                  <div className="d-flex align-items-start gap-3">
                    <div className="avatar-xs flex-shrink-0">
                      <span className="avatar-title rounded-circle bg-soft-primary text-primary">
                        {invitation.sender.firstName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-grow-1 overflow-hidden">
                      <strong className="d-block text-truncate">
                        {invitation.sender.username}
                      </strong>
                      <small className="text-muted d-block text-truncate">
                        {invitation.sender.email}
                      </small>
                      {invitation.message && (
                        <p className="mb-0 mt-2 text-body">
                          {invitation.message}
                        </p>
                      )}
                    </div>
                    <div className="d-flex gap-1 flex-shrink-0">
                      <Button
                        color="success"
                        size="sm"
                        title={t("contacts.acceptInvitation")}
                        aria-label={t("contacts.acceptFrom", {
                          name: invitation.sender.username,
                        })}
                        disabled={busy}
                        onClick={() => onRespond(invitation.id, "accepted")}
                      >
                        {busy ? (
                          <Spinner size="sm" />
                        ) : (
                          <i className="bx bx-check" aria-hidden="true"></i>
                        )}
                      </Button>
                      <Button
                        color="light"
                        size="sm"
                        title={t("contacts.declineInvitation")}
                        aria-label={t("contacts.declineFrom", {
                          name: invitation.sender.username,
                        })}
                        disabled={busy}
                        onClick={() => onRespond(invitation.id, "declined")}
                      >
                        <i className="bx bx-x" aria-hidden="true"></i>
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ContactInvitationsModal;
