import React from "react";

import { Button, Collapse, Card, CardBody, Input, Label } from "reactstrap";

interface MoreMenuProps {
  isOpen: boolean;
  onSelectImages: (images: Array<any>) => void;
  onToggle: () => any;
  onSelectFiles: (files: Array<any>) => void;
  onOpenCamera: () => void;
  onShareLocation: () => void;
  onOpenContacts: () => void;
}
const MoreMenu = ({
  isOpen,
  onSelectImages,
  onToggle,
  onSelectFiles,
  onOpenCamera,
  onShareLocation,
  onOpenContacts,
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
              <div className="text-center px-2 position-relative">
                <Button
                  type="button"
                  color="link"
                  className="avatar-sm mx-auto p-0 stretched-link"
                  title="Open camera"
                  aria-label="Open camera"
                  onClick={onOpenCamera}
                >
                  <span className="avatar-title font-size-18 bg-soft-primary text-primary rounded-circle">
                    <i className="bx bxs-camera"></i>
                  </span>
                </Button>
                <h5 className="font-size-11 text-uppercase mt-3 mb-0 text-body text-truncate">
                  Camera
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
              <div className="text-center px-2 position-relative">
                <div>
                  <Input
                    id="audio-file-input"
                    type="file"
                    className="d-none"
                    accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4"
                    onChange={(e: any) => onSelectF(e)}
                  />
                  <Label
                    htmlFor="audio-file-input"
                    className="avatar-sm mx-auto stretched-link cursor-pointer"
                  >
                    <span className="avatar-title font-size-18 bg-soft-primary text-primary rounded-circle">
                      <i className="bx bx-headphone"></i>
                    </span>
                  </Label>
                </div>
                <h5 className="font-size-11 text-uppercase mt-2 mb-0 text-body text-truncate">
                  Audio
                </h5>
              </div>
            </div>
            {/* Location */}
            <div className="flex-shrink-0" style={{ width: 88 }}>
              <div className="text-center px-2 position-relative">
                <Button
                  type="button"
                  color="link"
                  className="avatar-sm mx-auto p-0 stretched-link"
                  title="Share location"
                  aria-label="Share location"
                  onClick={onShareLocation}
                >
                  <span className="avatar-title font-size-18 bg-soft-primary text-primary rounded-circle">
                    <i className="bx bx-current-location"></i>
                  </span>
                </Button>
                <h5 className="font-size-11 text-uppercase mt-3 mb-0 text-body text-truncate">
                  Location
                </h5>
              </div>
            </div>

            {/* Contacts */}
            <div className="flex-shrink-0" style={{ width: 88 }}>
              <div className="text-center px-2 position-relative">
                <Button
                  type="button"
                  color="link"
                  className="avatar-sm mx-auto p-0 stretched-link"
                  title="Share contact"
                  aria-label="Share contact"
                  onClick={onOpenContacts}
                >
                  <span className="avatar-title font-size-18 bg-soft-primary text-primary rounded-circle">
                    <i className="bx bxs-user-circle"></i>
                  </span>
                </Button>
                <h5 className="font-size-11 text-uppercase mt-3 mb-0 text-body text-truncate">
                  Contacts
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
