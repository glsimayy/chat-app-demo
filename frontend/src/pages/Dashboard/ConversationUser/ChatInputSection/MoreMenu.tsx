import React from "react";
import { Link } from "react-router-dom";

import { Collapse, Card, CardBody, Input, Label } from "reactstrap";

interface MoreMenuProps {
  isOpen: boolean;
  onSelectImages: (images: Array<any>) => void;
  onToggle: () => any;
  onSelectFiles: (files: Array<any>) => void;
}
const MoreMenu = ({
  isOpen,
  onSelectImages,
  onToggle,
  onSelectFiles,
}: MoreMenuProps) => {
  const onSelect = (e: any) => {
    const files = [...e.target.files];
    if (files) {
      onSelectImages(files);
      e.target.value = "";
      onToggle();
    }
  };

  const onSelectF = (e: any) => {
    const files = [...e.target.files];
    if (files) {
      onSelectFiles(files);
      e.target.value = "";
      onToggle();
    }
  };

  return (
    <Collapse
      isOpen={isOpen}
      className="chat-input-collapse"
      id="chatinputmorecollapse"
    >
      <Card className="mb-0">
        <CardBody className="py-3">
          <div className="d-flex gap-3 overflow-auto py-1">
            {/* Attached */}
            <div className="flex-shrink-0" style={{ width: 88 }}>
              <div className="text-center px-2 position-relative">
                <div>
                  <Input
                    id="attachedfile-input"
                    type="file"
                    className="d-none"
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain"
                    onChange={(e: any) => onSelectF(e)}
                    multiple
                  />
                  <Label
                    htmlFor="attachedfile-input"
                    className="avatar-sm mx-auto stretched-link"
                  >
                    <span className="avatar-title font-size-18 bg-soft-primary text-primary rounded-circle">
                      <i className="bx bx-paperclip"></i>
                    </span>
                  </Label>
                </div>
                <h5 className="font-size-11 text-uppercase mt-2  mb-0 text-body text-truncate">
                  Attached
                </h5>
              </div>
            </div>

            {/* Camera */}
            <div className="flex-shrink-0" style={{ width: 88 }}>
              <div className="text-center px-2">
                <div className="avatar-sm mx-auto">
                  <div className="avatar-title font-size-18 bg-soft-primary text-primary rounded-circle">
                    <i className="bx bxs-camera"></i>
                  </div>
                </div>
                <h5 className="font-size-11 text-uppercase mt-3 mb-0 text-body text-truncate">
                  <Link to="#" className="text-body stretched-link">
                    Camera
                  </Link>
                </h5>
              </div>
            </div>

            {/* Gallery */}
            <div className="flex-shrink-0" style={{ width: 88 }}>
              <div className="text-center px-2 position-relative">
                <div>
                  <Input
                    id="attached-image-input"
                    type="file"
                    className="d-none"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e: any) => onSelect(e)}
                    multiple
                  />
                  <Label
                    htmlFor="attached-image-input"
                    className="avatar-sm mx-auto stretched-link cursor-pointer"
                  >
                    <span className="avatar-title font-size-18 bg-soft-primary text-primary rounded-circle">
                      <i className="bx bx-images"></i>
                    </span>
                  </Label>
                </div>
                <h5 className="font-size-11 text-uppercase mt-2 mb-0 text-body text-truncate">
                  Gallery
                </h5>
              </div>
            </div>
            {/* Audio */}

            <div className="flex-shrink-0" style={{ width: 88 }}>
              <div className="text-center px-2">
                <div className="avatar-sm mx-auto">
                  <div className="avatar-title font-size-18 bg-soft-primary text-primary rounded-circle">
                    <i className="bx bx-headphone"></i>
                  </div>
                </div>

                <h5 className="font-size-11 text-uppercase mt-3 mb-0 text-body text-truncate">
                  <Link to="#" className="text-body stretched-link">
                    Audio
                  </Link>
                </h5>
              </div>
            </div>
            {/* Location */}
            <div className="flex-shrink-0" style={{ width: 88 }}>
              <div className="text-center px-2">
                <div className="avatar-sm mx-auto">
                  <div className="avatar-title font-size-18 bg-soft-primary text-primary rounded-circle">
                    <i className="bx bx-current-location"></i>
                  </div>
                </div>
                <h5 className="font-size-11 text-uppercase mt-3 mb-0 text-body text-truncate">
                  <Link to="#" className="text-body stretched-link">
                    Location
                  </Link>
                </h5>
              </div>
            </div>

            {/* Contacts */}
            <div className="flex-shrink-0" style={{ width: 88 }}>
              <div className="text-center px-2">
                <div className="avatar-sm mx-auto">
                  <div className="avatar-title font-size-18 bg-soft-primary text-primary rounded-circle">
                    <i className="bx bxs-user-circle"></i>
                  </div>
                </div>
                <h5 className="font-size-11 text-uppercase mt-3 mb-0 text-body text-truncate">
                  <Link
                    to="#"
                    className="text-body stretched-link"
                    data-bs-toggle="modal"
                    data-bs-target=".contactModal"
                  >
                    Contacts
                  </Link>
                </h5>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </Collapse>
  );
};

export default MoreMenu;
