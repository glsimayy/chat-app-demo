import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export type VoiceRecorderStatus = "idle" | "requesting" | "recording";

const MAX_RECORDING_SECONDS = 120;
const AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

const getSupportedMimeType = () =>
  AUDIO_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type));

const normalizeMimeType = (value: string) =>
  value.split(";")[0] || "audio/webm";

const getFileExtension = (mimeType: string) => {
  switch (mimeType) {
    case "audio/mp4":
      return "m4a";
    case "audio/ogg":
      return "ogg";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
      return "wav";
    default:
      return "webm";
  }
};

const createRecordingName = (mimeType: string) => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  return `voice-message-${timestamp}.${getFileExtension(mimeType)}`;
};

interface UseVoiceRecorderOptions {
  onRecorded: (file: File) => void;
}

export const useVoiceRecorder = ({ onRecorded }: UseVoiceRecorderOptions) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<VoiceRecorderStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    releaseStream();
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
    setElapsedSeconds(0);
    setStatus("idle");
  }, [clearTimer, releaseStream]);

  const start = useCallback(async () => {
    if (
      status !== "idle" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        setError(t("chat.voiceUnsupported"));
      }
      return;
    }

    setError("");
    setStatus("requesting");
    cancelledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        cancelledRef.current = true;
        setError(t("chat.voiceRecordingFailed"));
        reset();
      };
      recorder.onstop = () => {
        const cancelled = cancelledRef.current;
        const chunks = chunksRef.current;
        const normalizedMimeType = normalizeMimeType(
          recorder.mimeType || chunks[0]?.type || "audio/webm",
        );

        reset();
        if (cancelled) {
          return;
        }

        const blob = new Blob(chunks, { type: normalizedMimeType });
        if (!blob.size) {
          setError(t("chat.voiceRecordingEmpty"));
          return;
        }

        onRecordedRef.current(
          new File([blob], createRecordingName(normalizedMimeType), {
            type: normalizedMimeType,
          }),
        );
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      setStatus("recording");
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - startedAtRef.current) / 1000),
        );
        setElapsedSeconds(elapsed);
        if (
          elapsed >= MAX_RECORDING_SECONDS &&
          recorder.state === "recording"
        ) {
          recorder.stop();
        }
      }, 250);
    } catch (recordingError) {
      reset();
      setError(
        recordingError instanceof DOMException &&
          recordingError.name === "NotAllowedError"
          ? t("chat.microphonePermission")
          : t("chat.microphoneOpenFailed"),
      );
    }
  }, [reset, status, t]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      cancelledRef.current = false;
      recorder.stop();
    }
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    cancelledRef.current = true;
    if (recorder?.state === "recording") {
      recorder.stop();
    } else {
      reset();
    }
  }, [reset]);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        recorder.stop();
      }
      clearTimer();
      releaseStream();
    },
    [clearTimer, releaseStream],
  );

  return {
    status,
    elapsedSeconds,
    error,
    clearError: () => setError(""),
    start,
    stop,
    cancel,
  };
};
