export type AudioCallStatus =
  | "calling"
  | "incoming"
  | "connecting"
  | "reconnecting"
  | "active"
  | "ended"
  | "failed";

export interface AudioCallPeer {
  id: string;
  displayName: string;
  profileImage?: string | null;
}

export interface AudioCallState {
  callId: string | null;
  conversationId: string;
  callerId?: string;
  recipientId?: string;
  direction: "incoming" | "outgoing";
  peer: AudioCallPeer;
  status: AudioCallStatus;
  isMuted: boolean;
  connectedAt?: number;
  statusMessage?: string;
}

export interface StartAudioCallInput {
  conversationId: string;
  targetUserId: string;
  displayName: string;
  profileImage?: string | null;
}

export type AudioCallDiagnosticLevel =
  "healthy" | "pending" | "warning" | "error";

export type RemoteAudioPlaybackState =
  "idle" | "waiting" | "playing" | "blocked";

export interface AudioTrackDiagnostics {
  available: boolean;
  enabled: boolean;
  muted: boolean;
  readyState: MediaStreamTrackState | "unavailable";
  label: string | null;
}

export interface AudioCandidatePairDiagnostics {
  state: string;
  localCandidateType: string | null;
  remoteCandidateType: string | null;
  protocol: string | null;
  relayProtocol: string | null;
}

export interface AudioRtpDiagnostics {
  bytes: number;
  packets: number;
  packetsLost: number;
  jitter: number | null;
}

export interface AudioCallDiagnostics {
  capturedAt: string;
  level: AudioCallDiagnosticLevel;
  summary: string;
  connectionState: RTCPeerConnectionState | "new";
  iceConnectionState: RTCIceConnectionState | "new";
  signalingState: RTCSignalingState | "stable";
  localTrack: AudioTrackDiagnostics;
  remoteTrack: AudioTrackDiagnostics;
  candidatePair: AudioCandidatePairDiagnostics | null;
  outbound: AudioRtpDiagnostics;
  inbound: AudioRtpDiagnostics;
  playbackState: RemoteAudioPlaybackState;
  playbackError: string | null;
}

export interface AudioCallContextValue {
  call: AudioCallState | null;
  diagnostics: AudioCallDiagnostics | null;
  startCall: (input: StartAudioCallInput) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  dismissCall: () => void;
  refreshDiagnostics: () => Promise<void>;
  resumeRemoteAudio: () => Promise<void>;
}
