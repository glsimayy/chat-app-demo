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
import {
  CALL_PEER_RECOVERY_MS,
  CALL_SOCKET_RECOVERY_MS,
  getPeerConnectionAction,
} from "./callRecovery";

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

interface SyncedCallState extends ServerCallState {
  direction: "incoming" | "outgoing";
  peer: {
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

const logCallEvent = (
  type: string,
  call: AudioCallState | null,
  detail?: string,
) => {
  console.info("[audio-call]", {
    type,
    callId: call?.callId ?? null,
    conversationId: call?.conversationId ?? null,
    direction: call?.direction ?? null,
    status: call?.status ?? null,
    detail: detail ?? null,
  });
};

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
  const socketRecoveryTimerRef = useRef<number | null>(null);
  const peerRecoveryTimerRef = useRef<number | null>(null);
  const terminalCallIdsRef = useRef(new Set<string>());
  const restartConnectionRef = useRef<() => Promise<void>>(async () => {});

  const updateCall = useCallback((next: AudioCallState | null) => {
    callRef.current = next;
    setCall(next);
  }, []);

  const clearSocketRecoveryTimer = useCallback(() => {
    if (socketRecoveryTimerRef.current !== null) {
      window.clearTimeout(socketRecoveryTimerRef.current);
      socketRecoveryTimerRef.current = null;
    }
  }, []);

  const clearPeerRecoveryTimer = useCallback(() => {
    if (peerRecoveryTimerRef.current !== null) {
      window.clearTimeout(peerRecoveryTimerRef.current);
      peerRecoveryTimerRef.current = null;
    }
  }, []);

  const releaseMedia = useCallback(() => {
    clearPeerRecoveryTimer();
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
  }, [clearPeerRecoveryTimer]);

  const emitTerminalEvent = useCallback(
    (
      socket: Socket | null,
      eventName: "call:end" | "call:reject",
      callId: string,
      payload: Record<string, unknown>,
    ) => {
      if (terminalCallIdsRef.current.has(callId)) {
        return;
      }

      terminalCallIdsRef.current.add(callId);
      if (socket?.connected) {
        socket.emit(eventName, { callId, ...payload });
      }
    },
    [],
  );

  const finishCallLocally = useCallback(
    (message: string, status: "ended" | "failed" = "failed") => {
      const current = callRef.current;
      clearSocketRecoveryTimer();
      releaseMedia();

      if (!current) {
        return;
      }

      if (current.callId) {
        terminalCallIdsRef.current.add(current.callId);
      }
      logCallEvent("call_finished_locally", current, message);
      updateCall({
        ...current,
        status,
        statusMessage: message,
        isMuted: false,
      });
    },
    [clearSocketRecoveryTimer, releaseMedia, updateCall],
  );

  const failCall = useCallback(
    (message: string, notifyServer = true) => {
      const current = callRef.current;
      const socket = getChatSocket();
      if (notifyServer && current?.callId) {
        emitTerminalEvent(socket, "call:end", current.callId, {});
      }
      finishCallLocally(message);
    },
    [emitTerminalEvent, finishCallLocally],
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

    logCallEvent("call_signal_sent", current, signal.signalType);
    socket.emit("call:signal", { callId: current.callId, ...signal });
  }, []);

  const beginPeerRecovery = useCallback(
    (peerState: RTCPeerConnectionState) => {
      const current = callRef.current;
      if (
        !current ||
        current.status === "ended" ||
        current.status === "failed"
      ) {
        return;
      }

      logCallEvent("peer_recovery_started", current, peerState);
      updateCall({
        ...current,
        status: "reconnecting",
        statusMessage: "Restoring audio connection...",
      });

      if (peerRecoveryTimerRef.current === null) {
        peerRecoveryTimerRef.current = window.setTimeout(() => {
          peerRecoveryTimerRef.current = null;
          if (peerConnectionRef.current?.connectionState === "connected") {
            return;
          }

          failCall(
            "The audio connection could not be restored. A TURN server may be required on this network.",
          );
        }, CALL_PEER_RECOVERY_MS);
      }

      const socket = getChatSocket();
      if (current.direction === "outgoing") {
        void restartConnectionRef.current();
      } else if (socket?.connected && current.callId) {
        socket.emit("call:recover", { callId: current.callId });
      }
    },
    [failCall, updateCall],
  );

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

      const action = getPeerConnectionAction(peer.connectionState);
      logCallEvent("peer_connection_state", current, peer.connectionState);

      if (action === "connected") {
        clearPeerRecoveryTimer();
        updateCall({
          ...current,
          status: "active",
          statusMessage: undefined,
          connectedAt: current.connectedAt ?? Date.now(),
        });
      } else if (action === "recover") {
        beginPeerRecovery(peer.connectionState);
      }
    };

    return peer;
  }, [beginPeerRecovery, clearPeerRecoveryTimer, sendSignal, updateCall]);

  const restartConnection = useCallback(async () => {
    const current = callRef.current;
    const socket = getChatSocket();
    if (
      !current?.callId ||
      current.direction !== "outgoing" ||
      !socket?.connected ||
      !localStreamRef.current
    ) {
      return;
    }

    try {
      const existingPeer = peerConnectionRef.current;
      const peer =
        existingPeer && existingPeer.connectionState !== "closed"
          ? existingPeer
          : createPeerConnection();
      peer.restartIce();
      const offer = await peer.createOffer({ iceRestart: true });
      await peer.setLocalDescription(offer);
      logCallEvent("peer_recovery_offer_created", current);
      sendSignal({ signalType: "offer", sdp: offer.sdp });
    } catch (error) {
      logCallEvent(
        "peer_recovery_offer_failed",
        current,
        error instanceof Error ? error.message : "Unknown recovery error",
      );
    }
  }, [createPeerConnection, sendSignal]);
  restartConnectionRef.current = restartConnection;

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
      logCallEvent("call_start_requested", initialCall);

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
        logCallEvent("call_started", {
          ...current,
          callId: session.callId,
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
    } catch (error) {
      emitTerminalEvent(socket, "call:reject", current.callId, {
        reason: "declined",
      });
      failCall(microphoneErrorMessage(error), false);
      return;
    }

    try {
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
      emitTerminalEvent(socket, "call:end", current.callId, {});
      failCall(microphoneErrorMessage(error), false);
    }
  }, [
    createPeerConnection,
    emitTerminalEvent,
    failCall,
    getMicrophone,
    updateCall,
  ]);

  const rejectCall = useCallback(() => {
    const current = callRef.current;
    const socket = getChatSocket();
    if (current?.callId && socket) {
      emitTerminalEvent(socket, "call:reject", current.callId, {
        reason: "declined",
      });
    }
    clearSocketRecoveryTimer();
    releaseMedia();
    updateCall(null);
  }, [clearSocketRecoveryTimer, emitTerminalEvent, releaseMedia, updateCall]);

  const endCall = useCallback(() => {
    const current = callRef.current;
    const socket = getChatSocket();
    if (current?.callId && socket) {
      emitTerminalEvent(socket, "call:end", current.callId, {});
    }
    clearSocketRecoveryTimer();
    releaseMedia();
    updateCall(null);
  }, [clearSocketRecoveryTimer, emitTerminalEvent, releaseMedia, updateCall]);

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
    clearSocketRecoveryTimer();
    releaseMedia();
    updateCall(null);
  }, [clearSocketRecoveryTimer, releaseMedia, updateCall]);

  const beginSocketRecovery = useCallback(() => {
    const current = callRef.current;
    if (!current || current.status === "ended" || current.status === "failed") {
      return;
    }

    logCallEvent("socket_recovery_started", current);
    updateCall({
      ...current,
      status: "reconnecting",
      statusMessage: "Reconnecting to the call...",
    });
    clearSocketRecoveryTimer();
    socketRecoveryTimerRef.current = window.setTimeout(() => {
      socketRecoveryTimerRef.current = null;
      finishCallLocally(
        "Realtime connection could not be restored. Check your network and try again.",
      );
    }, CALL_SOCKET_RECOVERY_MS);
  }, [clearSocketRecoveryTimer, finishCallLocally, updateCall]);

  const syncCallState = useCallback(
    async (socket: Socket) => {
      const session = await emitWithAck<SyncedCallState | null>(
        socket,
        "call:sync",
        {},
      );
      clearSocketRecoveryTimer();
      const current = callRef.current;

      if (!session) {
        if (
          current &&
          current.status !== "ended" &&
          current.status !== "failed"
        ) {
          finishCallLocally("The call ended while reconnecting.", "ended");
        }
        return;
      }

      if (terminalCallIdsRef.current.has(session.callId)) {
        socket.emit("call:end", { callId: session.callId });
        return;
      }

      if (current?.callId && current.callId !== session.callId) {
        releaseMedia();
      }

      const restored: AudioCallState = {
        callId: session.callId,
        conversationId: session.conversationId,
        callerId: session.callerId,
        recipientId: session.recipientId,
        direction: session.direction,
        peer: {
          id: session.peer.id,
          displayName: session.peer.username,
          profileImage: session.peer.profileImage,
        },
        status:
          session.status === "ringing"
            ? session.direction === "incoming"
              ? "incoming"
              : "calling"
            : peerConnectionRef.current?.connectionState === "connected"
              ? "active"
              : "reconnecting",
        isMuted: current?.isMuted ?? false,
        connectedAt: current?.connectedAt,
        statusMessage:
          session.status === "active" &&
          peerConnectionRef.current?.connectionState !== "connected"
            ? "Restoring audio connection..."
            : undefined,
      };
      updateCall(restored);
      logCallEvent("call_state_synced", restored, session.status);

      try {
        if (session.direction === "outgoing" && !localStreamRef.current) {
          await getMicrophone();
        }

        if (session.status === "active") {
          if (!localStreamRef.current) {
            await getMicrophone();
          }
          if (!peerConnectionRef.current) {
            createPeerConnection();
          }
          if (
            session.direction === "outgoing" &&
            peerConnectionRef.current?.connectionState !== "connected"
          ) {
            await restartConnection();
          } else if (
            session.direction === "incoming" &&
            peerConnectionRef.current?.connectionState !== "connected"
          ) {
            socket.emit("call:recover", { callId: session.callId });
          }
        }
      } catch (error) {
        failCall(microphoneErrorMessage(error));
      }
    },
    [
      clearSocketRecoveryTimer,
      createPeerConnection,
      failCall,
      finishCallLocally,
      getMicrophone,
      releaseMedia,
      restartConnection,
      updateCall,
    ],
  );

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

      const incomingCall: AudioCallState = {
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
      };
      logCallEvent("call_incoming", incomingCall);
      updateCall(incomingCall);
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
        logCallEvent("call_accepted", current);
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

      try {
        logCallEvent("call_signal_received", current, event.signalType);
        let peer = peerConnectionRef.current;
        if (!peer && event.signalType === "ice-candidate" && event.candidate) {
          pendingCandidatesRef.current.push({
            candidate: event.candidate,
            sdpMid: event.sdpMid,
            sdpMLineIndex: event.sdpMLineIndex,
            usernameFragment: event.usernameFragment,
          });
          return;
        }
        if (!peer && event.signalType === "offer") {
          if (!localStreamRef.current) {
            await getMicrophone();
          }
          peer = createPeerConnection();
        }
        if (!peer) {
          return;
        }

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

      finishCallLocally(
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
      finishCallLocally(messages[event.reason || ""] || "Call ended", "ended");
    };
    const onDismissed = (event: { callId: string }) => {
      const current = callRef.current;
      if (!current || current.callId !== event.callId) {
        return;
      }

      terminalCallIdsRef.current.add(event.callId);
      clearSocketRecoveryTimer();
      releaseMedia();
      updateCall(null);
    };
    const onDisconnect = () => {
      beginSocketRecovery();
    };
    const onConnect = async () => {
      try {
        await syncCallState(socket);
      } catch (error) {
        const current = callRef.current;
        logCallEvent(
          "call_sync_failed",
          current,
          error instanceof Error ? error.message : "Unknown sync error",
        );
        if (current) {
          finishCallLocally("The call session could not be restored.");
        }
      }
    };
    const onRecoveryNeeded = (event: ServerCallState) => {
      const current = callRef.current;
      if (
        !current ||
        current.callId !== event.callId ||
        current.direction !== "outgoing"
      ) {
        return;
      }

      void restartConnection();
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
    socket.on("call:recovery-needed", onRecoveryNeeded);
    socket.on("call:history-updated", onHistoryUpdated);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);

    if (socket.connected) {
      void onConnect();
    } else {
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
      socket.off("call:recovery-needed", onRecoveryNeeded);
      socket.off("call:history-updated", onHistoryUpdated);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
      clearSocketRecoveryTimer();
      releaseMedia();
    };
  }, [
    beginSocketRecovery,
    clearSocketRecoveryTimer,
    createPeerConnection,
    failCall,
    finishCallLocally,
    getMicrophone,
    releaseMedia,
    restartConnection,
    sendSignal,
    syncCallState,
    updateCall,
  ]);

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
