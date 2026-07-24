import React, { useState } from "react";
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  Label,
  Input,
} from "reactstrap";

// interface
import { BookMarkTypes } from "../data/bookmarks";

interface DataTypes {
  bookmarkTitle: string | null;
}

interface UpdateDeleteBookmarkProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (data: any) => void;
  bookmark: BookMarkTypes;
}
const UpdateDeleteBookmark = ({
  isOpen,
  onClose,
  onUpdate,
  bookmark,
}: UpdateDeleteBookmarkProps) => {
  /*
   data input handeling
   */
  const [data, setData] = useState<DataTypes>({
    bookmarkTitle: bookmark.title,
  });

  const onChangeData = (field: "bookmarkTitle", value: string) => {
    let modifiedData: DataTypes = { ...data };
    if (value === "") {
      modifiedData[field] = null;
    } else {
      modifiedData[field] = value;
    }
    setData(modifiedData);
  };

  const onSubmit = () => {
    onUpdate(data);
  };
  return (
    <Modal isOpen={isOpen} toggle={onClose}>
      <ModalHeader
        className="modal-title-custom text-white font-size-16"
        toggle={onClose}
      >
        Edit Saved Message
      </ModalHeader>
      <ModalBody>
        <Form>
          <FormGroup>
            <Label htmlFor="update-bookmark" className="mb-2">
              Custom Label
            </Label>
            <Input
              type="text"
              name="bookmarkTitle"
              id="update-bookmark"
              maxLength={120}
              placeholder="Add a label"
              value={data.bookmarkTitle || ""}
              onChange={(e: any) => {
                onChangeData("bookmarkTitle", e.target.value);
              }}
            />
            <small className="text-muted">
              Leave empty to use the message text.
            </small>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="button" color="none" onClick={onClose}>
          Close
        </Button>
        <Button color="primary" onClick={onSubmit}>
          Update
        </Button>{" "}
      </ModalFooter>
    </Modal>
  );
};

export default UpdateDeleteBookmark;
