import React, { useEffect, useRef, useState } from "react";
import { Alert, Form, Input } from "reactstrap";

// components
import StartButtons from "./StartButtons";
import InputSection from "./InputSection";
import EndButtons from "./EndButtons";
import MoreMenu from "./MoreMenu";
import Reply from "./Reply";
import ShareContactModal from "./ShareContactModal";
import CameraCaptureModal from "./CameraCaptureModal";
import { createSharedContactMessage } from "../../../../utils/sharedContact";
import {
  clearMessageDraft,
  readMessageDraft,
  writeMessageDraft,
} from "../../../../utils/messageDrafts";
import { useVoiceRecorder } from "../../../../features/voice-message/useVoiceRecorder";

// interface
import { MessagesTypes } from "../../../../data/messages";

const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
]);

interface IndexProps {
  onSend: (data: any) => void;
  onTyping: (value: string) => void;
  replyData: null | MessagesTypes | undefined;
  onSetReplyData: (reply: null | MessagesTypes | undefined) => void;
  chatUserDetails: any;
  draftKey: string;
  canSend?: boolean;
  disabledMessage?: string;
}
const Index = ({
  onSend,
  onTyping,
  replyData,
  onSetReplyData,
  chatUserDetails,
  draftKey,
  canSend = true,
  disabledMessage = "Messaging is unavailable in this conversation.",
}: IndexProps) => {
  /*
  more menu collapse
  */
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const onToggle = () => {
    setIsOpen(!isOpen);
    setemojiArray(true);
  };

  /*
  disable send button
  */
  const [disabled, setDisabled] = useState<boolean>(true);

  /*
  input text
  */
  const [text, setText] = useState("");
  const [sharedContact, setSharedContact] = useState<any>(null);
  useEffect(() => {
    setText(readMessageDraft(draftKey));
    setSharedContact(null);
  }, [draftKey]);

  const updateText = (value: string, emitTyping = true) => {
    setText(value);
    writeMessageDraft(draftKey, value);
    if (emitTyping) {
      onTyping(value);
    }
  };
  const onChangeText = (value: string) => {
    if (sharedContact) {
      setSharedContact(null);
    }
    updateText(value);
  };

  /*
  images
  */
  const [images, setImages] = useState<File[]>([]);
  const [selectionError, setSelectionError] = useState("");

  /*
  files
  */
  const [files, setFiles] = useState<File[]>([]);
  const applySelection = (nextImages: File[], nextFiles: File[]) => {
    const selected = [...nextImages, ...nextFiles];

    if (selected.length > MAX_ATTACHMENT_COUNT) {
      setSelectionError(
        `You can attach at most ${MAX_ATTACHMENT_COUNT} files to one message.`,
      );
      return;
    }

    const oversized = selected.find(file => file.size > MAX_ATTACHMENT_BYTES);

    if (oversized) {
      setSelectionError(`${oversized.name} is larger than 5 MB.`);
      return;
    }

    const unsupported = selected.find(
      file => !ALLOWED_ATTACHMENT_TYPES.has(file.type),
    );

    if (unsupported) {
      setSelectionError(`${unsupported.name} has an unsupported file type.`);
      return;
    }

    setSelectionError("");
    setImages(nextImages);
    setFiles(nextFiles);
  };
  const onSelectImages = (selectedImages: File[]) => {
    applySelection(selectedImages, files);
  };
  const onSelectFiles = (selectedFiles: File[]) => {
    applySelection(images, selectedFiles);
  };
  const voiceRecording = useVoiceRecorder({
    onRecorded: file => {
      applySelection(images, [...files, file]);
    },
  });
  const voiceFile = files.find(file => file.type.startsWith("audio/"));
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");

  useEffect(() => {
    if (!voiceFile) {
      setVoicePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(voiceFile);
    setVoicePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [voiceFile]);

  useEffect(() => {
    voiceRecording.cancel();
    // A recording belongs to the conversation in which it was started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (text || images.length || files.length || sharedContact) {
      setDisabled(false);
    } else {
      setDisabled(true);
    }
  }, [text, images, files, sharedContact]);

  // emoji picker
  const [emojiArray, setemojiArray] = useState<any>("");
  const [emojiPicker, setemojiPicker] = useState<boolean>(false);
  const onEmojiClick = (event: any) => {
    setemojiArray([...emojiArray, event.emoji]);
    updateText(`${text}${event.emoji}`);
  };

  // Submit Message
  const onSubmit = () => {
    let data: any = {};
    if (text) {
      data["text"] = text;
    }
    if (sharedContact) {
      data["text"] = createSharedContactMessage(sharedContact.id);
    }
    const selectedFiles = [...(images || []), ...(files || [])];

    if (selectedFiles.length) {
      data["files"] = selectedFiles;
    }
    if (replyData?.mId) {
      data["replyToMessageId"] = String(replyData.mId);
      data["replyOf"] = replyData;
    }

    updateText("", false);
    clearMessageDraft(draftKey);
    onTyping("");
    setImages([]);
    setFiles([]);
    setSharedContact(null);
    setSelectionError("");
    setemojiPicker(false);
    onSend(data);
  };

  const onClearMedia = () => {
    setImages([]);
    setFiles([]);
    setSelectionError("");
  };

  const [isShareContactOpen, setIsShareContactOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const appendText = (value: string) => {
    const nextText = [text?.trim(), value].filter(Boolean).join("\n");
    updateText(nextText);
  };
  const onShareContact = (contact: any) => {
    updateText("", false);
    onTyping("");
    setSharedContact(contact);
    setIsShareContactOpen(false);
    setIsOpen(false);
  };
  const onOpenCamera = () => {
    setIsOpen(false);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      nativeCameraInputRef.current?.click();
      return;
    }
    setIsCameraOpen(true);
  };
  const onNativeCameraCapture = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onSelectImages([file]);
    }
  };
  const onShareLocation = () => {
    if (!navigator.geolocation) {
      setSelectionError("Location sharing is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        appendText(
          `Location: https://www.google.com/maps?q=${latitude},${longitude}`,
        );
        setSelectionError("");
        setIsOpen(false);
      },
      () => setSelectionError("Location permission was denied or unavailable."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const onStartRecording = () => {
    setIsOpen(false);
    setemojiPicker(false);
    onTyping("");
    void voiceRecording.start();
  };
  const formatRecordingDuration = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
      seconds % 60,
    ).padStart(2, "0")}`;

  if (!canSend) {
    return (
      <div className="chat-input-section p-3 p-lg-4">
        <div className="alert alert-secondary mb-0 d-flex align-items-center gap-2">
          <i className="bx bx-lock-alt font-size-18" aria-hidden="true"></i>
          <span>{disabledMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-input-section p-3 p-lg-4">
      <Form
        id="chatinput-form"
        onSubmit={(e: any) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="row g-0 align-items-center chat-input-row">
          <div className="col-auto">
            <StartButtons
              onToggle={onToggle}
              onEmojiClick={onEmojiClick}
              setemojiPicker={setemojiPicker}
              emojiPicker={emojiPicker}
            />
          </div>
          <div className="col">
            {voiceRecording.status === "recording" ? (
              <div
                className="voice-recording-status"
                role="status"
                aria-label={`Recording voice message, ${formatRecordingDuration(
                  voiceRecording.elapsedSeconds,
                )}`}
              >
                <span className="voice-recording-dot" aria-hidden="true"></span>
                <strong>Recording</strong>
                <span>
                  {formatRecordingDuration(voiceRecording.elapsedSeconds)}
                </span>
              </div>
            ) : (
              <InputSection value={text} onChange={onChangeText} />
            )}
          </div>
          <div className="col-auto">
            <EndButtons
              disabled={disabled}
              voiceStatus={voiceRecording.status}
              onStartRecording={onStartRecording}
              onStopRecording={voiceRecording.stop}
              onCancelRecording={voiceRecording.cancel}
            />
          </div>
        </div>
      </Form>
      {images.length || files.length ? (
        <Alert
          isOpen={true}
          toggle={onClearMedia}
          color="secondary"
          className="alert-dismiss-custom 
        rounded-pill font-size-12 mb-1 selected-media"
          closeClassName="selected-media-close"
        >
          <p className="me-2 mb-0">
            {images.length > 0 &&
              files.length === 0 &&
              ` You have selected ${images.length} images`}
            {files.length > 0 &&
              images.length === 0 &&
              ` You have selected ${files.length} files`}
            {files.length > 0 &&
              images.length > 0 &&
              ` You have selected ${files.length} files & ${images.length} images.`}
          </p>
        </Alert>
      ) : null}

      {selectionError && (
        <Alert color="danger" className="font-size-12 mt-2 mb-0">
          {selectionError}
        </Alert>
      )}

      {voiceRecording.error && (
        <Alert
          color="danger"
          className="font-size-12 mt-2 mb-0"
          toggle={voiceRecording.clearError}
        >
          {voiceRecording.error}
        </Alert>
      )}

      {voicePreviewUrl && voiceFile && (
        <div className="voice-message-preview mt-2">
          <div className="voice-message-preview-copy">
            <i className="bx bxs-microphone" aria-hidden="true"></i>
            <span>Voice message ready to send</span>
          </div>
          <audio
            controls
            preload="metadata"
            src={voicePreviewUrl}
            aria-label="Voice message preview"
          />
        </div>
      )}

      {sharedContact && (
        <Alert
          color="secondary"
          className="font-size-12 mt-2 mb-0 d-flex align-items-center"
          toggle={() => setSharedContact(null)}
        >
          <i className="bx bx-user me-2" aria-hidden="true"></i>
          Sharing contact:{" "}
          <strong className="ms-1">{sharedContact.username}</strong>
        </Alert>
      )}

      <MoreMenu
        isOpen={isOpen}
        onSelectImages={onSelectImages}
        onSelectFiles={onSelectFiles}
        onToggle={onToggle}
        onOpenCamera={onOpenCamera}
        onShareLocation={onShareLocation}
        onOpenContacts={() => {
          setIsShareContactOpen(true);
          setIsOpen(false);
        }}
      />

      <ShareContactModal
        isOpen={isShareContactOpen}
        onClose={() => setIsShareContactOpen(false)}
        onShare={onShareContact}
      />

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={file => onSelectImages([file])}
      />
      <Input
        innerRef={nativeCameraInputRef}
        type="file"
        className="d-none"
        accept="image/*"
        capture="environment"
        onChange={onNativeCameraCapture}
      />

      <Reply
        reply={replyData}
        onSetReplyData={onSetReplyData}
        chatUserDetails={chatUserDetails}
      />
    </div>
  );
};

export default Index;
