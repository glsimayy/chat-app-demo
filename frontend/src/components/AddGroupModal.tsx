import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import classnames from "classnames";

import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Label,
  Input,
  Collapse,
  Form,
} from "reactstrap";

//utils
import { DivideByKeyResultTypes } from "../utils";

// interfaaces
import { ContactTypes } from "../data/contacts";
import { useContacts } from "../hooks";
import { CreateChannelPostData } from "../redux/actions";

// components
import AppSimpleBar from "./AppSimpleBar";

interface DataTypes {
  id: any;
  channelName: string;
  description: string;
  memberCanSendMessages: boolean;
  membersCanLeave: boolean;
}
interface ContactItemProps {
  contact: ContactTypes;
  selected: boolean;
  onSelectContact: (id: string | number, selected: boolean) => void;
}
const ContactItem = ({
  contact,
  selected,
  onSelectContact,
}: ContactItemProps) => {
  const fullName = `${contact.firstName} ${contact.lastName}`;
  const onCheck = (checked: boolean) => {
    onSelectContact(contact.id, checked);
  };

  return (
    <li>
      <div className="form-check">
        <Input
          type="checkbox"
          className="form-check-input"
          id={`contact-${contact.id}`}
          checked={selected}
          onChange={(e: any) => {
            onCheck(e.target.checked);
          }}
          value={fullName}
        />
        <Label className="form-check-label" htmlFor={`contact-${contact.id}`}>
          {fullName}
        </Label>
      </div>
    </li>
  );
};

interface CharacterItemProps {
  letterContacts: DivideByKeyResultTypes;
  index: number;
  totalContacts: number;
  selectedContacts: Array<number | string>;
  onSelectContact: (id: string | number, selected: boolean) => void;
}

const CharacterItem = ({
  letterContacts,
  index,
  totalContacts,
  selectedContacts,
  onSelectContact,
}: CharacterItemProps) => {
  return (
    <div>
      <div className="contact-list-title">{letterContacts.letter}</div>

      <ul
        className={classnames("list-unstyled", "contact-list", {
          "mb-0": index + 1 === totalContacts,
        })}
      >
        {(letterContacts.data || []).map((contact: any, key: number) => {
          const selected: boolean = selectedContacts.includes(contact.id);
          return (
            <ContactItem
              contact={contact}
              key={key}
              selected={selected}
              onSelectContact={onSelectContact}
            />
          );
        })}
      </ul>
    </div>
  );
};
interface AddGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChannel: (params: CreateChannelPostData) => void;
}
const AddGroupModal = ({
  isOpen,
  onClose,
  onCreateChannel,
}: AddGroupModalProps) => {
  const { t } = useTranslation();
  /*
    collapse handeling
    */
  const [isOpenCollapse, setIsOpenCollapse] = useState(false);
  const toggleCollapse = () => {
    setIsOpenCollapse(!isOpenCollapse);
  };

  /*
    contacts hook
    */
  const { categorizedContacts, totalContacts } = useContacts();
  /*
  select contacts
  */
  const [selectedContacts, setSelectedContacts] = useState<
    Array<string | number>
  >([]);
  const [selectedManagers, setSelectedManagers] = useState<
    Array<string | number>
  >([]);
  const onSelectContact = (id: string | number, selected: boolean) => {
    let modifiedList: Array<string | number> = [...selectedContacts];
    if (selected) {
      modifiedList = [...modifiedList, id];
    } else {
      modifiedList = modifiedList.filter(m => m + "" !== id + "");
      setSelectedManagers(current =>
        current.filter(managerId => managerId + "" !== id + ""),
      );
    }
    setSelectedContacts(modifiedList);
  };

  /*
    data
    */
  const [data, setData] = useState<DataTypes>({
    id: "",
    channelName: "",
    description: "",
    memberCanSendMessages: false,
    membersCanLeave: true,
  });
  const onDataChange = (field: keyof DataTypes, value: any) => {
    setData(current => ({ ...current, [field]: value }) as DataTypes);
  };

  /*
    disale button
    */
  // const [valid, setValid] = useState(false);
  // useEffect(() => {
  //   if (
  //     selectedContacts.length === 0 &&
  //     !data.description &&
  //     data.description === ""
  //   ) {
  //     setValid(false);
  //   } else {
  //     setValid(true);
  //   }
  // }, [selectedContacts, data]);

  /*
    submit data
    */
  const onSubmit = () => {
    const params = {
      id: data.id,
      name: data.channelName,
      members: selectedContacts,
      managerIds: selectedManagers,
      description: data.description,
      memberCanSendMessages: data.memberCanSendMessages,
      membersCanLeave: data.membersCanLeave,
    };
    onCreateChannel(params);
  };

  const selectedContactRecords = (categorizedContacts || [])
    .flatMap((group: DivideByKeyResultTypes) => group.data || [])
    .filter((contact: any) => selectedContacts.includes(contact.id));

  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      tabIndex={-1}
      centered
      scrollable
      color="white"
      id="addgroup-exampleModal"
      role="dialog"
    >
      {/* <ModalHeader className="modal-title-custom bg-primary " toggle={onClose} >
      Create New Group
     </ModalHeader> */}
      <ModalHeader toggle={onClose} className="bg-primary">
        <div className="modal-title modal-title-custom text-white bg-primary font-size-16">
          {t("groupManagement.createNew")}
        </div>
      </ModalHeader>
      {/* <div className="modal-title text-white font-size-16 bg-primary text-white">
        creact new grop
      </div> */}

      <ModalBody className="p-4">
        <Form>
          <div className="mb-4">
            <Label htmlFor="addgroupname-input" className="form-label">
              {t("groupManagement.groupName")}
            </Label>
            <Input
              type="text"
              className="form-control"
              id="addgroupname-input"
              placeholder={t("groupManagement.enterGroupName")}
              value={data.channelName || ""}
              onChange={(e: any) => {
                onDataChange("channelName", e.target.value);
              }}
            />
          </div>
          <div className="mb-4">
            <label className="form-label">
              {t("groupManagement.groupMembers")}
            </label>
            <div className="mb-3">
              <Button
                color="light"
                size="sm"
                type="button"
                onClick={toggleCollapse}
              >
                {t("groupManagement.selectMembers")}
              </Button>
            </div>

            <Collapse isOpen={isOpenCollapse} id="groupmembercollapse">
              <div className="card border">
                <div className="card-header">
                  <h5 className="font-size-15 mb-0">{t("nav.contacts")}</h5>
                </div>
                <div className="card-body p-2">
                  <AppSimpleBar style={{ maxHeight: "150px" }}>
                    {(categorizedContacts || []).map(
                      (letterContacts: DivideByKeyResultTypes, key: number) => (
                        <CharacterItem
                          letterContacts={letterContacts}
                          key={key}
                          index={key}
                          totalContacts={totalContacts}
                          selectedContacts={selectedContacts}
                          onSelectContact={onSelectContact}
                        />
                      ),
                    )}
                  </AppSimpleBar>
                </div>
              </div>
            </Collapse>
          </div>
          {selectedContactRecords.length > 0 && (
            <div className="mb-4">
              <Label className="form-label">
                {t("groupManagement.groupManagers")}
              </Label>
              <div className="border p-2">
                {selectedContactRecords.map((contact: any) => {
                  const managerSelected = selectedManagers.includes(contact.id);
                  return (
                    <div className="form-check" key={contact.id}>
                      <Input
                        type="checkbox"
                        className="form-check-input"
                        id={`manager-${contact.id}`}
                        checked={managerSelected}
                        onChange={event =>
                          setSelectedManagers(current =>
                            event.target.checked
                              ? [...current, contact.id]
                              : current.filter(id => id !== contact.id),
                          )
                        }
                      />
                      <Label
                        className="form-check-label"
                        htmlFor={`manager-${contact.id}`}
                      >
                        {contact.firstName} {contact.lastName}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mb-3">
            <Label htmlFor="addgroupdescription-input" className="form-label">
              {t("groupManagement.description")}
            </Label>
            <textarea
              className="form-control"
              id="addgroupdescription-input"
              rows={3}
              placeholder={t("groupManagement.enterDescription")}
              value={data.description || ""}
              onChange={(e: any) => {
                onDataChange("description", e.target.value);
              }}
            />
          </div>
          <div className="form-check form-switch mb-3">
            <Input
              type="switch"
              id="group-member-messages"
              checked={data.memberCanSendMessages}
              onChange={event =>
                onDataChange("memberCanSendMessages", event.target.checked)
              }
            />
            <Label htmlFor="group-member-messages" className="form-check-label">
              {t("groupManagement.membersCanSendPolicy")}
            </Label>
          </div>
          <div className="form-check form-switch">
            <Input
              type="switch"
              id="group-members-leave"
              checked={data.membersCanLeave}
              onChange={event =>
                onDataChange("membersCanLeave", event.target.checked)
              }
            />
            <Label htmlFor="group-members-leave" className="form-check-label">
              {t("groupManagement.membersCanLeaveGroup")}
            </Label>
          </div>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button color="link" type="button" onClick={onClose}>
          {t("common.close")}
        </Button>
        <Button
          type="button"
          color="primary"
          onClick={onSubmit}
          disabled={
            data.channelName.trim().length < 3 || selectedContacts.length === 0
          }
        >
          {t("groupManagement.createGroup")}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AddGroupModal;
