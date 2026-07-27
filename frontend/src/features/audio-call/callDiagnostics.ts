import {
  AudioCallDiagnosticLevel,
  AudioCallDiagnostics,
  AudioCandidatePairDiagnostics,
  AudioRtpDiagnostics,
  AudioTrackDiagnostics,
  RemoteAudioPlaybackState,
} from "./types";

interface CallDiagnosticsInput {
  peer: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  playbackState: RemoteAudioPlaybackState;
  playbackError?: string | null;
}

type StatsRecord = Record<string, unknown> & {
  id: string;
  type: string;
};

const emptyRtpDiagnostics = (): AudioRtpDiagnostics => ({
  bytes: 0,
  packets: 0,
  packetsLost: 0,
  jitter: null,
});

const toNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toNullableNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toNullableString = (value: unknown) =>
  typeof value === "string" && value ? value : null;

const isAudioReport = (report: StatsRecord) =>
  report.kind === "audio" || report.mediaType === "audio";

const getTrackDiagnostics = (
  stream: MediaStream | null,
): AudioTrackDiagnostics => {
  const track = stream?.getAudioTracks()[0];
  if (!track) {
    return {
      available: false,
      enabled: false,
      muted: false,
      readyState: "unavailable",
      label: null,
    };
  }

  return {
    available: true,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
    label: track.label || null,
  };
};

const findSelectedCandidatePair = (
  records: Map<string, StatsRecord>,
): AudioCandidatePairDiagnostics | null => {
  const transport = Array.from(records.values()).find(
    report =>
      report.type === "transport" &&
      typeof report.selectedCandidatePairId === "string",
  );
  const selectedPairId = toNullableString(transport?.selectedCandidatePairId);
  const pair =
    (selectedPairId ? records.get(selectedPairId) : undefined) ??
    Array.from(records.values()).find(
      report =>
        report.type === "candidate-pair" &&
        report.nominated === true &&
        report.state === "succeeded",
    );

  if (!pair) {
    return null;
  }

  const localCandidate = records.get(String(pair.localCandidateId ?? ""));
  const remoteCandidate = records.get(String(pair.remoteCandidateId ?? ""));

  return {
    state: toNullableString(pair.state) ?? "unknown",
    localCandidateType: toNullableString(localCandidate?.candidateType),
    remoteCandidateType: toNullableString(remoteCandidate?.candidateType),
    protocol:
      toNullableString(localCandidate?.protocol) ??
      toNullableString(remoteCandidate?.protocol),
    relayProtocol:
      toNullableString(localCandidate?.relayProtocol) ??
      toNullableString(remoteCandidate?.relayProtocol),
  };
};

const getRtpDiagnostics = (
  records: Map<string, StatsRecord>,
  direction: "inbound-rtp" | "outbound-rtp",
): AudioRtpDiagnostics => {
  const report = Array.from(records.values()).find(
    item => item.type === direction && isAudioReport(item) && !item.isRemote,
  );
  if (!report) {
    return emptyRtpDiagnostics();
  }

  return {
    bytes: toNumber(
      direction === "inbound-rtp" ? report.bytesReceived : report.bytesSent,
    ),
    packets: toNumber(
      direction === "inbound-rtp" ? report.packetsReceived : report.packetsSent,
    ),
    packetsLost: toNumber(report.packetsLost),
    jitter: toNullableNumber(report.jitter),
  };
};

export const summarizeAudioCallDiagnostics = (
  diagnostics: Omit<AudioCallDiagnostics, "level" | "summary">,
): { level: AudioCallDiagnosticLevel; summary: string } => {
  if (
    diagnostics.connectionState === "failed" ||
    diagnostics.iceConnectionState === "failed"
  ) {
    return {
      level: "error",
      summary: "The network audio path failed.",
    };
  }

  if (
    diagnostics.connectionState === "disconnected" ||
    diagnostics.iceConnectionState === "disconnected"
  ) {
    return {
      level: "warning",
      summary: "The network audio path was interrupted.",
    };
  }

  if (diagnostics.connectionState !== "connected") {
    return {
      level: "pending",
      summary: "Waiting for the peer audio connection.",
    };
  }

  if (!diagnostics.localTrack.available) {
    return {
      level: "error",
      summary: "No local microphone track is available.",
    };
  }

  if (diagnostics.localTrack.readyState === "ended") {
    return {
      level: "error",
      summary: "The local microphone track ended.",
    };
  }

  if (!diagnostics.localTrack.enabled) {
    return {
      level: "warning",
      summary: "The microphone is muted.",
    };
  }

  if (diagnostics.playbackState === "blocked") {
    return {
      level: "error",
      summary: "The browser blocked remote audio playback.",
    };
  }

  if (diagnostics.outbound.bytes === 0) {
    return {
      level: "warning",
      summary: "Connected, but no outgoing audio data is visible yet.",
    };
  }

  if (!diagnostics.remoteTrack.available || diagnostics.inbound.bytes === 0) {
    return {
      level: "warning",
      summary: "Connected, but no incoming audio data is visible yet.",
    };
  }

  return {
    level: "healthy",
    summary: "Two-way audio data is flowing.",
  };
};

export const collectAudioCallDiagnostics = async ({
  peer,
  localStream,
  remoteStream,
  playbackState,
  playbackError = null,
}: CallDiagnosticsInput): Promise<AudioCallDiagnostics> => {
  const records = new Map<string, StatsRecord>();
  if (peer) {
    const stats = await peer.getStats();
    stats.forEach(report => {
      records.set(report.id, report as StatsRecord);
    });
  }

  const base = {
    capturedAt: new Date().toISOString(),
    connectionState: peer?.connectionState ?? ("new" as const),
    iceConnectionState: peer?.iceConnectionState ?? ("new" as const),
    signalingState: peer?.signalingState ?? ("stable" as const),
    localTrack: getTrackDiagnostics(localStream),
    remoteTrack: getTrackDiagnostics(remoteStream),
    candidatePair: findSelectedCandidatePair(records),
    outbound: getRtpDiagnostics(records, "outbound-rtp"),
    inbound: getRtpDiagnostics(records, "inbound-rtp"),
    playbackState,
    playbackError,
  };
  const summary = summarizeAudioCallDiagnostics(base);

  return {
    ...base,
    ...summary,
  };
};
