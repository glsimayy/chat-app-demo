import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "reactstrap";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const CameraCaptureModal = ({
  isOpen,
  onClose,
  onCapture,
}: CameraCaptureModalProps) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let active = true;
    setError("");
    setLoading(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("chat.cameraUnavailable"));
      setLoading(false);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      .then(stream => {
        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(playError => {
            if (
              active &&
              (!(playError instanceof DOMException) ||
                playError.name !== "AbortError")
            ) {
              setError(t("chat.cameraPreviewFailed"));
            }
          });
        }
      })
      .catch(() => {
        if (active) {
          setError(t("chat.cameraAccessBlocked"));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      stopCamera();
    };
  }, [isOpen, t]);

  const close = () => {
    stopCamera();
    onClose();
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError(t("chat.cameraNotReady"));
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      blob => {
        if (!blob) {
          setError(t("chat.photoCaptureFailed"));
          return;
        }
        onCapture(
          new File([blob], `camera-${Date.now()}.jpg`, {
            type: "image/jpeg",
          }),
        );
        close();
      },
      "image/jpeg",
      0.9,
    );
  };

  const onNativeCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    onCapture(file);
    close();
  };

  return (
    <Modal isOpen={isOpen} toggle={close} centered size="lg">
      <ModalHeader toggle={close}>{t("chat.camera")}</ModalHeader>
      <ModalBody>
        {error && <Alert color="warning">{error}</Alert>}
        <div className="camera-capture-preview bg-dark rounded overflow-hidden position-relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label={t("chat.cameraPreview")}
            className="w-100 d-block"
          />
          {loading && (
            <div className="camera-capture-loading d-flex align-items-center justify-content-center">
              <Spinner color="light" />
            </div>
          )}
        </div>
        <Input
          innerRef={nativeInputRef}
          type="file"
          className="d-none"
          accept="image/*"
          capture="environment"
          onChange={onNativeCapture}
        />
      </ModalBody>
      <ModalFooter className="justify-content-between">
        <Button
          type="button"
          color="light"
          onClick={() => nativeInputRef.current?.click()}
        >
          <i className="bx bx-mobile-alt me-2" aria-hidden="true"></i>
          {t("chat.useDeviceCamera")}
        </Button>
        <Button
          type="button"
          color="primary"
          disabled={loading || !streamRef.current}
          onClick={captureFrame}
        >
          <i className="bx bxs-camera me-2" aria-hidden="true"></i>
          {t("chat.takePhoto")}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CameraCaptureModal;
