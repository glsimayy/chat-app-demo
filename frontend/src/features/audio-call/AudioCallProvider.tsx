import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Socket } from "socket.io-client";
import { getChatSocket } from "../../api/realtime";
import AudioCallOverlay from "./AudioCallOverlay";
import {
  AudioCallContextValue,
  AudioCallState,
  StartAudioCallInput,
} from "./types";

interface SocketAck<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

interface ServerCallState {
  callId: string;
  conversationId: string;
  callerId: string;
  recipientId: string;
  status: "ringing" | "active";
}

interface IncomingCallEvent extends ServerCallState {
  caller: {
    id: string;
    username: string;
    profileImage?: string | null;
  };
}

interface CallSignalEvent {
  callId: string;
  signalType: "offer" | "answer" | "ice-candidate";
  sdp?: string;
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

const AudioCallContext = createContext<AudioCallContextValue | null>(null);

const fallbackIceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const getIceServers = () => {
  const configured = process.env.REACT_APP_WEBRTC_ICE_SERVERS;
  if (!configured) {
    return fallbackIceServers;
  }

  try {
    const parsed = JSON.parse(configured);
    return Array.isArray(parsed)
      ? (parsed as RTCIceServer[])
      : fallbackIceServers;
  } catch {
    return fallbackIceServers;
  }
};

const emitWithAck = <T,>(
  socket: Socket,
  eventName: string,
  payload: unknown,
  timeoutMs = 8000,
) =>
  new Promise<T>((resolve, reject) => {
    socket
      .timeout(timeoutMs)
      .emit(
        eventName,
        payload,
        (timeoutError: Error | null, response: SocketAck<T>) => {
          if (timeoutError) {
            reject(new Error("The call server did not respond"));
            return;
          }

          if (!response?.success || response.data === undefined) {
            reject(new Error(response?.message || "The call request failed"));
            return;
          }

          resolve(response.data);
        },
      );
  });

const waitForSocket = (socket: Socket) => {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Realtime connection is unavailable"));
    }, 6000);
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Realtime connection is unavailable"));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
    socket.connect();
  });
};

const microphoneErrorMessage = (error: unknown) => {
  if (!window.isSecureContext) {
    return "Audio calls require HTTPS or localhost";
  }

  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone permission was denied";
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found";
  }

  return error instanceof Error
    ? error.message
    : "Microphone could not be opened";
};

export const AudioCallProvider = ({ children }: { children: ReactNode }) => {
  const [call, setCall] = useState<AudioCallState | null>(null);
  const callRef = useRef<AudioCallState | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const updateCall = useCallback((next: AudioCallState | null) => {
    callRef.current = next;
    setCall(next);
  }, []);

  const releaseMedia = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current?.getTracks().forEach(track => track.stop());
    remoteStreamRef.current = null;
    pendingCandidatesRef.current = [];

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const failCall = useCallback(
    (message: string) => {
      const current = callRef.current;
      const socket = getChatSocket();
      if (current?.callId && socket?.connected) {
        socket.emit("call:end", { callId: current.callId });
      }
      releaseMedia();

      if (!current) {
        return;
      }

      updateCall({
        ...current,
        status: "failed",
        statusMessage: message,
        isMuted: false,
      });
    },
    [releaseMedia, updateCall],
  );

  const getMicrophone = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Audio calls require HTTPS or localhost");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const sendSignal = useCallback((signal: Omit<CallSignalEvent, "callId">) => {
    const socket = getChatSocket();
    const current = callRef.current;
    if (!socket || !current?.callId) {
      return;
    }

    socket.emit("call:signal", { callId: current.callId, ...signal });
  }, []);

  const createPeerConnection = useCallback(() => {
    peerConnectionRef.current?.close();
    const peer = new RTCPeerConnection({ iceServers: getIceServers() });
    peerConnectionRef.current = peer;
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    for (const track of localStreamRef.current?.getTracks() ?? []) {
      peer.addTrack(track, localStreamRef.current!);
    }

    peer.onicecandidate = event => {
      if (!event.candidate) {
        return;
      }

      const candidate = event.candidate.toJSON();
      sendSignal({
        signalType: "ice-candidate",
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment,
      });
    };
    peer.ontrack = event => {
      for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
        if (!remoteStream.getTracks().some(item => item.id === track.id)) {
          remoteStream.addTrack(track);
        }
      }

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    };
    peer.onconnectionstatechange = () => {
      const current = callRef.current;
      if (!current) {
        return;
      }

      if (peer.connectionState === "connected") {
        updateCall({
          ...current,
          status: "active",
          statusMessage: undefined,
          connectedAt: current.connectedAt ?? Date.now(),
        });
      } else if (peer.connectionState === "failed") {
        failCall("The audio connection failed");
      }
    };

    return peer;
  }, [failCall, sendSignal, updateCall]);

  const startCall = useCallback(
    async (input: StartAudioCallInput) => {
      if (callRef.current) {
        return;
      }

      const socket = getChatSocket();
      const initialCall: AudioCallState = {
        callId: null,
        conversationId: input.conversationId,
        direction: "outgoing",
        peer: {
          id: input.targetUserId,
          displayName: input.displayName,
          profileImage: input.profileImage,
        },
        status: "connecting",
        isMuted: false,
        statusMessage: "Opening microphone...",
      };
      updateCall(initialCall);

      try {
        if (!socket) {
          throw new Error("You must be logged in to start a call");
        }

        await waitForSocket(socket);
        await getMicrophone();
        updateCall({
          ...initialCall,
          status: "calling",
          statusMessage: undefined,
        });
        const session = await emitWithAck<ServerCallState>(
          socket,
          "call:start",
          {
            conversationId: input.conversationId,
            targetUserId: input.targetUserId,
          },
        );
        const current = callRef.current as AudioCallState | null;
        if (!current) {
          socket.emit("call:end", { callId: session.callId });
          return;
        }

        updateCall({
          ...current,
          callId: session.callId,
          callerId: session.callerId,
          recipientId: session.recipientId,
          status: "calling",
          statusMessage: undefined,
        });
      } catch (error) {
        failCall(microphoneErrorMessage(error));
      }
    },
    [failCall, getMicrophone, updateCall],
  );

  const acceptCall = useCallback(async () => {
    const current = callRef.current;
    const socket = getChatSocket();
    if (!current?.callId || current.status !== "incoming" || !socket) {
      return;
    }

    updateCall({
      ...current,
      status: "connecting",
      statusMessage: "Opening microphone...",
    });

    try {
      await getMicrophone();
      createPeerConnection();
      await emitWithAck<ServerCallState>(socket, "call:accept", {
        callId: current.callId,
      });
      const latest = callRef.current;
      if (latest) {
        updateCall({
          ...latest,
          status: "connecting",
          statusMessage: "Connecting securely...",
        });
      }
    } catch (error) {
      socket.emit("call:reject", {
        callId: current.callId,
        reason: "declined",
      });
      failCall(microphoneErrorMessage(error));
    }
  }, [createPeerConnection, failCall, getMicrophone, updateCall]);

  const rejectCall = useCallback(() => {
    const current = callRef.current;
    const socket = getChatSocket();
    if (current?.callId && socket) {
      socket.emit("call:reject", {
        callId: current.callId,
        reason: "declined",
      });
    }
    releaseMedia();
    updateCall(null);
  }, [releaseMedia, updateCall]);

  const endCall = useCallback(() => {
    const current = callRef.current;
    const socket = getChatSocket();
    if (current?.callId && socket) {
      socket.emit("call:end", { callId: current.callId });
    }
    releaseMedia();
    updateCall(null);
  }, [releaseMedia, updateCall]);

  const toggleMute = useCallback(() => {
    const current = callRef.current;
    if (!current || current.status !== "active") {
      return;
    }

    const nextMuted = !current.isMuted;
    localStreamRef.current
      ?.getAudioTracks()
      .forEach(track => (track.enabled = !nextMuted));
    updateCall({ ...current, isMuted: nextMuted });
  }, [updateCall]);

  const dismissCall = useCallback(() => {
    releaseMedia();
    updateCall(null);
  }, [releaseMedia, updateCall]);

  useEffect(() => {
    const socket = getChatSocket();
    if (!socket) {
      return;
    }

    const onIncoming = (event: IncomingCallEvent) => {
      if (callRef.current) {
        socket.emit("call:reject", {
          callId: event.callId,
          reason: "busy",
        });
        return;
      }

      updateCall({
        callId: event.callId,
        conversationId: event.conversationId,
        callerId: event.callerId,
        recipientId: event.recipientId,
        direction: "incoming",
        peer: {
          id: event.caller.id,
          displayName: event.caller.username,
          profileImage: event.caller.profileImage,
        },
        status: "incoming",
        isMuted: false,
      });
    };
    const onAccepted = async (event: ServerCallState) => {
      const current = callRef.current;
      if (
        !current ||
        current.callId !== event.callId ||
        current.direction !== "outgoing"
      ) {
        return;
      }

      try {
        updateCall({
          ...current,
          status: "connecting",
          statusMessage: "Connecting securely...",
        });
        const peer = createPeerConnection();
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        sendSignal({ signalType: "offer", sdp: offer.sdp });
      } catch (error) {
        failCall(
          error instanceof Error
            ? error.message
            : "The audio connection could not be created",
        );
      }
    };
    const onSignal = async (event: CallSignalEvent) => {
      const current = callRef.current;
      if (!current || current.callId !== event.callId) {
        return;
      }

      const peer = peerConnectionRef.current;
      if (!peer) {
        return;
      }

      try {
        if (event.signalType === "offer" && event.sdp) {
          await peer.setRemoteDescription({
            type: "offer",
            sdp: event.sdp,
          });
          for (const candidate of pendingCandidatesRef.current) {
            await peer.addIceCandidate(candidate);
          }
          pendingCandidatesRef.current = [];
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal({ signalType: "answer", sdp: answer.sdp });
        } else if (event.signalType === "answer" && event.sdp) {
          await peer.setRemoteDescription({
            type: "answer",
            sdp: event.sdp,
          });
          for (const candidate of pendingCandidatesRef.current) {
            await peer.addIceCandidate(candidate);
          }
          pendingCandidatesRef.current = [];
        } else if (event.signalType === "ice-candidate" && event.candidate) {
          const candidate: RTCIceCandidateInit = {
            candidate: event.candidate,
            sdpMid: event.sdpMid,
            sdpMLineIndex: event.sdpMLineIndex,
            usernameFragment: event.usernameFragment,
          };

          if (peer.remoteDescription) {
            await peer.addIceCandidate(candidate);
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        }
      } catch {
        failCall("The audio connection could not be negotiated");
      }
    };
    const onRejected = (event: ServerCallState & { reason?: string }) => {
      const current = callRef.current;
      if (!current || current.callId !== event.callId) {
        return;
      }

      failCall(
        event.reason === "busy"
          ? `${current.peer.displayName} is already in another call`
          : `${current.peer.displayName} declined the call`,
      );
    };
    const onEnded = (
      event: ServerCallState & { reason?: string; endedBy?: string | null },
    ) => {
      const current = callRef.current;
      if (!current || current.callId !== event.callId) {
        return;
      }

      const messages: Record<string, string> = {
        unanswered: "No answer",
        "peer-disconnected": "The other participant disconnected",
        "caller-unavailable": "The caller is no longer available",
      };
      releaseMedia();
      updateCall({
        ...current,
        status: "ended",
        statusMessage: messages[event.reason || ""] || "Call ended",
        isMuted: false,
      });
    };
    const onDismissed = (event: { callId: string }) => {
      const current = callRef.current;
      if (!current || current.callId !== event.callId) {
        return;
      }

      releaseMedia();
      updateCall(null);
    };
    const onDisconnect = () => {
      const current = callRef.current;
      if (current) {
        failCall("Realtime connection was lost");
      }
    };
    const onHistoryUpdated = () => {
      window.dispatchEvent(new Event("ello:calls-updated"));
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:signal", onSignal);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended", onEnded);
    socket.on("call:answered-elsewhere", onDismissed);
    socket.on("call:dismissed", onDismissed);
    socket.on("call:history-updated", onHistoryUpdated);
    socket.on("disconnect", onDisconnect);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:signal", onSignal);
      socket.off("call:rejected", onRejected);
      socket.off("call:ended", onEnded);
      socket.off("call:answered-elsewhere", onDismissed);
      socket.off("call:dismissed", onDismissed);
      socket.off("call:history-updated", onHistoryUpdated);
      socket.off("disconnect", onDisconnect);
      releaseMedia();
    };
  }, [createPeerConnection, failCall, releaseMedia, sendSignal, updateCall]);

  const value: AudioCallContextValue = {
    call,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    dismissCall,
  };

  return (
    <AudioCallContext.Provider value={value}>
      {children}
      <audio ref={remoteAudioRef} autoPlay className="d-none" />
      <AudioCallOverlay {...value} />
    </AudioCallContext.Provider>
  );
};

export const useAudioCall = () => {
  const context = useContext(AudioCallContext);
  if (!context) {
    throw new Error("useAudioCall must be used inside AudioCallProvider");
  }

  return context;
};
