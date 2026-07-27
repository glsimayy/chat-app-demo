import {
  collectAudioCallDiagnostics,
  summarizeAudioCallDiagnostics,
} from "./callDiagnostics";
import {
  AudioCallDiagnostics,
  AudioTrackDiagnostics,
  RemoteAudioPlaybackState,
} from "./types";

const activeTrack: AudioTrackDiagnostics = {
  available: true,
  enabled: true,
  muted: false,
  readyState: "live",
  label: "Test microphone",
};

const baseDiagnostics = (
  overrides: Partial<AudioCallDiagnostics> = {},
): AudioCallDiagnostics => ({
  capturedAt: "2026-07-28T00:00:00.000Z",
  level: "pending",
  summary: "",
  connectionState: "connected",
  iceConnectionState: "connected",
  signalingState: "stable",
  localTrack: activeTrack,
  remoteTrack: { ...activeTrack, label: "Remote audio" },
  candidatePair: null,
  outbound: { bytes: 1200, packets: 12, packetsLost: 0, jitter: null },
  inbound: { bytes: 900, packets: 9, packetsLost: 0, jitter: 0.01 },
  playbackState: "playing",
  playbackError: null,
  ...overrides,
});

describe("audio call diagnostics", () => {
  it("recognizes a healthy two-way audio flow", () => {
    expect(summarizeAudioCallDiagnostics(baseDiagnostics())).toEqual({
      level: "healthy",
      summary: "Two-way audio data is flowing.",
    });
  });

  it.each([
    [
      "blocked playback",
      { playbackState: "blocked" as RemoteAudioPlaybackState },
      "error",
      "The browser blocked remote audio playback.",
    ],
    [
      "missing inbound data",
      { inbound: { bytes: 0, packets: 0, packetsLost: 0, jitter: null } },
      "warning",
      "Connected, but no incoming audio data is visible yet.",
    ],
    [
      "failed ICE",
      { iceConnectionState: "failed" as RTCIceConnectionState },
      "error",
      "The network audio path failed.",
    ],
  ])("reports %s", (_name, overrides, level, summary) => {
    expect(
      summarizeAudioCallDiagnostics(baseDiagnostics(overrides)),
    ).toMatchObject({ level, summary });
  });

  it("collects the selected candidate path and RTP counters", async () => {
    const reports = new Map<string, Record<string, unknown>>([
      [
        "transport-1",
        {
          id: "transport-1",
          type: "transport",
          selectedCandidatePairId: "pair-1",
        },
      ],
      [
        "pair-1",
        {
          id: "pair-1",
          type: "candidate-pair",
          state: "succeeded",
          nominated: true,
          localCandidateId: "local-1",
          remoteCandidateId: "remote-1",
        },
      ],
      [
        "local-1",
        {
          id: "local-1",
          type: "local-candidate",
          candidateType: "srflx",
          protocol: "udp",
        },
      ],
      [
        "remote-1",
        {
          id: "remote-1",
          type: "remote-candidate",
          candidateType: "host",
          protocol: "udp",
        },
      ],
      [
        "outbound-1",
        {
          id: "outbound-1",
          type: "outbound-rtp",
          kind: "audio",
          bytesSent: 2048,
          packetsSent: 20,
        },
      ],
      [
        "inbound-1",
        {
          id: "inbound-1",
          type: "inbound-rtp",
          kind: "audio",
          bytesReceived: 1024,
          packetsReceived: 10,
          packetsLost: 1,
          jitter: 0.02,
        },
      ],
    ]);
    const peer = {
      connectionState: "connected",
      iceConnectionState: "connected",
      signalingState: "stable",
      getStats: jest.fn().mockResolvedValue(reports),
    } as unknown as RTCPeerConnection;
    const stream = {
      getAudioTracks: () => [
        {
          enabled: true,
          muted: false,
          readyState: "live",
          label: "Test microphone",
        },
      ],
    } as unknown as MediaStream;

    const diagnostics = await collectAudioCallDiagnostics({
      peer,
      localStream: stream,
      remoteStream: stream,
      playbackState: "playing",
    });

    expect(diagnostics).toMatchObject({
      level: "healthy",
      candidatePair: {
        state: "succeeded",
        localCandidateType: "srflx",
        remoteCandidateType: "host",
        protocol: "udp",
      },
      outbound: { bytes: 2048, packets: 20 },
      inbound: { bytes: 1024, packets: 10, packetsLost: 1, jitter: 0.02 },
    });
  });
});
