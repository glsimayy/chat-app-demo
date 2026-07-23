import React, { useEffect, useState } from "react";
import {
  Form,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Label,
  Input,
} from "reactstrap";

interface DataTypes {
  email: string;
  message: string;
}
interface InviteContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (data: any) => void;
}
const InviteContactModal = ({
  isOpen,
  onClose,
  onInvite,
}: InviteContactModalProps) => {
  /*
  data input handeling
  */
  const [data, setData] = useState<DataTypes>({
    email: "",
    message: "",
  });
  useEffect(() => {
    setData({
      email: "",
      message: "",
    });
  }, [isOpen]);

  const onChangeData = (field: keyof DataTypes, value: string) => {
    setData(current => ({ ...current, [field]: value }));
  };
  const valid = /^\S+@\S+\.\S+$/.test(data.email.trim());
  return (
    <Modal isOpen={isOpen} toggle={onClose} tabIndex={-1} centered scrollable>
      <ModalHeader toggle={onClose} className="bg-primary">
        <div className="modal-title-custom text-white font-size-16">
          Invite contact
        </div>
      </ModalHeader>
      <ModalBody className="p-4">
        <Form>
          <div className="mb-3">
            <Label htmlFor="AddContactModalemail-input" className="form-label">
              Email
            </Label>
            <Input
              type="email"
              className="form-control"
              id="AddContactModalemail-input"
              placeholder="Enter Email"
              value={data.email}
              onChange={(e: any) => {
                onChangeData("email", e.target.value);
              }}
            />
          </div>
          <div className="">
            <Label
              htmlFor="AddContactModal-invitemessage-input"
              className="form-label"
            >
              Invitation message
            </Label>
            <textarea
              value={data.message}
              onChange={(e: any) => {
                onChangeData("message", e.target.value);
              }}
              className="form-control"
              id="AddContactModal-invitemessage-input"
              rows={3}
              maxLength={300}
              placeholder="Add an optional message"
            ></textarea>
          </div>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="button" color="link" className="btn" onClick={onClose}>
          Close
        </Button>
        <Button
          type="button"
          color="primary"
          disabled={!valid}
          onClick={() =>
            onInvite({
              email: data.email.trim(),
              message: data.message.trim() || undefined,
            })
          }
        >
          Invite
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default InviteContactModal;
