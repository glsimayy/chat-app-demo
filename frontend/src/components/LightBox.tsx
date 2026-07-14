import React, { useEffect, useState } from "react";
import { Button, Modal, ModalBody } from "reactstrap";

interface LightBoxProps {
  isOpen: boolean;
  onClose: () => any;
  images: Array<any>;
  defaultIdx?: number;
}
const LightBox = ({ isOpen, onClose, defaultIdx, images }: LightBoxProps) => {
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setPhotoIndex(defaultIdx ?? 0);
    }
  }, [defaultIdx, isOpen]);

  const onPrev = () => {
    setPhotoIndex((photoIndex + images.length - 1) % images.length);
  };
  const onNext = () => {
    setPhotoIndex((photoIndex + 1) % images.length);
  };

  const activeImage = images[photoIndex];

  return (
    <Modal
      isOpen={isOpen && Boolean(activeImage)}
      toggle={onClose}
      centered
      size="xl"
      contentClassName="border-0 bg-dark"
    >
      <ModalBody className="d-flex align-items-center justify-content-center p-0 position-relative bg-dark">
        <img
          src={activeImage?.downloadLink}
          alt="Preview"
          className="img-fluid"
          style={{ maxHeight: "85vh", objectFit: "contain" }}
        />
        <Button
          type="button"
          color="dark"
          aria-label="Close preview"
          className="position-absolute top-0 end-0 m-3"
          onClick={onClose}
        >
          <i className="bx bx-x font-size-24" />
        </Button>
        {images.length > 1 && (
          <>
            <Button
              type="button"
              color="dark"
              aria-label="Previous image"
              className="position-absolute top-50 start-0 translate-middle-y ms-3"
              onClick={onPrev}
            >
              <i className="bx bx-chevron-left font-size-24" />
            </Button>
            <Button
              type="button"
              color="dark"
              aria-label="Next image"
              className="position-absolute top-50 end-0 translate-middle-y me-3"
              onClick={onNext}
            >
              <i className="bx bx-chevron-right font-size-24" />
            </Button>
          </>
        )}
      </ModalBody>
    </Modal>
  );
};

export default LightBox;
