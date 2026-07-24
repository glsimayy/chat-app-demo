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

export interface AudioCallContextValue {
  call: AudioCallState | null;
  startCall: (input: StartAudioCallInput) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  dismissCall: () => void;
}
