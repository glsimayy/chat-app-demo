import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalHeader,
  Spinner,
} from "reactstrap";
import { getContacts } from "../../../../api/contacts";

interface ShareContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (contact: any) => void;
}

const ShareContactModal = ({
  isOpen,
  onClose,
  onShare,
}: ShareContactModalProps) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSearch("");
    setError("");
    setLoading(true);
    getContacts()
      .then(setContacts)
      .catch(reason => setError(String(reason || "Contacts could not be loaded")))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return contacts;
    }
    return contacts.filter(contact =>
      `${contact.username} ${contact.email}`.toLowerCase().includes(query),
    );
  }, [contacts, search]);

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered scrollable>
      <ModalHeader toggle={onClose}>Share contact</ModalHeader>
      <ModalBody>
        <Input
          type="search"
          aria-label="Search contacts to share"
          placeholder="Search contacts"
          className="mb-3"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        {error && <Alert color="danger">{error}</Alert>}
        {loading ? (
          <div className="text-center p-4">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="list-group list-group-flush">
            {filteredContacts.map(contact => (
              <Button
                type="button"
                color="light"
                className="list-group-item list-group-item-action text-start"
                key={contact.id}
                onClick={() => onShare(contact)}
              >
                <strong className="d-block">{contact.username}</strong>
                <small className="text-muted">{contact.email}</small>
              </Button>
            ))}
            {!loading && filteredContacts.length === 0 && (
              <div className="text-center text-muted p-4">No contacts found</div>
            )}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ShareContactModal;
