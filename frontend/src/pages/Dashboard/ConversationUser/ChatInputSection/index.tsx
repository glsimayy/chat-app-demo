import React, { useEffect, useState } from "react";
import { Alert, Form } from "reactstrap";

// components
import StartButtons from "./StartButtons";
import InputSection from "./InputSection";
import EndButtons from "./EndButtons";
import MoreMenu from "./MoreMenu";
import Reply from "./Reply";

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
]);

interface IndexProps {
  onSend: (data: any) => void;
  onTyping: (value: string) => void;
  replyData: null | MessagesTypes | undefined;
  onSetReplyData: (reply: null | MessagesTypes | undefined) => void;
  chatUserDetails: any;
  canSend?: boolean;
  disabledMessage?: string;
}
const Index = ({
  onSend,
  onTyping,
  replyData,
  onSetReplyData,
  chatUserDetails,
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
  const [text, setText] = useState<null | string>("");
  const onChangeText = (value: string) => {
    setText(value);
    onTyping(value);
  };

  /*
  images
  */
  const [images, setImages] = useState<Array<any> | null | undefined>();
  const [selectionError, setSelectionError] = useState("");

  /*
  files
  */
  const [files, setFiles] = useState<Array<any> | null | undefined>();
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
    applySelection(selectedImages, (files || []) as File[]);
  };
  const onSelectFiles = (selectedFiles: File[]) => {
    applySelection((images || []) as File[], selectedFiles);
  };
  useEffect(() => {
    if (text || images || files) {
      setDisabled(false);
    } else {
      setDisabled(true);
    }
  }, [text, images, files]);

  // emoji picker
  const [emojiArray, setemojiArray] = useState<any>("");
  const [emojiPicker, setemojiPicker] = useState<boolean>(false);
  const onEmojiClick = (event: any) => {
    setemojiArray([...emojiArray, event.emoji]);
    setText(text + event.emoji);
  };

  // Submit Message
  const onSubmit = () => {
    let data: any = {};
    if (text) {
      data["text"] = text;
    }
    const selectedFiles = [...(images || []), ...(files || [])];

    if (selectedFiles.length) {
      data["files"] = selectedFiles;
    }

    setText("");
    onTyping("");
    setImages(null);
    setFiles(null);
    setSelectionError("");
    setemojiPicker(false);
    onSend(data);
  };

  const onClearMedia = () => {
    setImages(null);
    setFiles(null);
    setSelectionError("");
  };

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
            <InputSection value={text} onChange={onChangeText} />
          </div>
          <div className="col-auto">
            <EndButtons disabled={disabled} />
          </div>
        </div>
      </Form>
      {(images && images.length) || (files && files.length) ? (
        <Alert
          isOpen={true}
          toggle={onClearMedia}
          color="secondary"
          className="alert-dismiss-custom 
        rounded-pill font-size-12 mb-1 selected-media"
          closeClassName="selected-media-close"
        >
          <p className="me-2 mb-0">
            {images && !files && ` You have selected ${images.length} images`}
            {files && !images && ` You have selected ${files.length} files`}
            {files &&
              images &&
              ` You have selected ${files.length} files & ${images.length} images.`}
          </p>
        </Alert>
      ) : null}

      {selectionError && (
        <Alert color="danger" className="font-size-12 mt-2 mb-0">
          {selectionError}
        </Alert>
      )}

      <MoreMenu
        isOpen={isOpen}
        onSelectImages={onSelectImages}
        onSelectFiles={onSelectFiles}
        onToggle={onToggle}
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
