import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EgressClient,
  type EgressInfo,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
} from "livekit-server-sdk";
import type { RecordingKind } from "../../domain/recording.policy";
import { LiveKitService } from "./livekit.service";
import {
  recordingStorageConfiguration,
  type RecordingStorageConfiguration,
} from "./recording-storage.config";

/** Provider failure reduced to a stable code; provider messages may hold credentials. */
export class RecordingProviderError extends Error {
  constructor(
    readonly code:
      | "EGRESS_START_FAILED"
      | "EGRESS_STOP_FAILED"
      | "EGRESS_LIST_FAILED"
      | "ROOM_METADATA_FAILED",
  ) {
    super(`LiveKit recording call failed: ${code}`);
  }
}

/** Provider-neutral Egress state, shared by webhooks and the reconcile worker. */
export type EgressSnapshot = {
  egressId: string;
  status: "ACTIVE" | "COMPLETE" | "FAILED";
  startedAt: Date | null;
  endedAt: Date | null;
  /** The first file result, when Egress reports one with bytes. */
  file: { bytes: bigint; durationMs: bigint } | null;
};

/** The provider surface the recording services depend on; tests supply a fake. */
export interface RecordingEgress {
  readonly available: boolean;
  start(input: {
    roomName: string;
    objectKey: string;
    kind: RecordingKind;
  }): Promise<{ egressId: string }>;
  stop(egressId: string): Promise<void>;
  list(roomName: string): Promise<EgressSnapshot[]>;
  setIndicator(
    roomName: string,
    recording: { id: string; kind: RecordingKind } | null,
  ): Promise<void>;
}

function snapshotStatus(status: EgressStatus): EgressSnapshot["status"] {
  // A provider limit ends the Egress but may still leave a usable file.
  if (
    status === EgressStatus.EGRESS_COMPLETE ||
    status === EgressStatus.EGRESS_LIMIT_REACHED
  )
    return "COMPLETE";
  if (
    status === EgressStatus.EGRESS_FAILED ||
    status === EgressStatus.EGRESS_ABORTED
  )
    return "FAILED";
  return "ACTIVE";
}

const NS_PER_MS = 1_000_000n;

function nanosToDate(value: bigint) {
  return value > 0n ? new Date(Number(value / NS_PER_MS)) : null;
}

/** Normalizes provider data; the error text is dropped because it may hold credentials. */
export function egressSnapshot(info: EgressInfo): EgressSnapshot {
  const result = info.fileResults[0];
  const file =
    result && result.size > 0n
      ? {
          bytes: result.size,
          durationMs: result.duration > 0n ? result.duration / NS_PER_MS : 0n,
        }
      : null;
  return {
    egressId: info.egressId,
    status: snapshotStatus(info.status),
    startedAt: nanosToDate(info.startedAt),
    endedAt: nanosToDate(info.endedAt),
    file,
  };
}

@Injectable()
export class LiveKitEgressService implements RecordingEgress {
  private readonly logger = new Logger(LiveKitEgressService.name);
  private readonly storage: RecordingStorageConfiguration;

  constructor(
    private readonly livekit: LiveKitService,
    config: ConfigService,
  ) {
    this.storage = recordingStorageConfiguration(
      Object.fromEntries(
        [
          "STORAGE_ENABLED",
          "STORAGE_ENDPOINT",
          "STORAGE_REGION",
          "S3_BUCKET",
          "RECORDING_STORAGE_ACCESS_KEY_ID",
          "RECORDING_STORAGE_SECRET_ACCESS_KEY",
        ].map((key) => [key, config.get(key)]),
      ),
    );
  }

  get available() {
    return this.livekit.config.enabled && this.storage.enabled;
  }

  async start(input: {
    roomName: string;
    objectKey: string;
    kind: RecordingKind;
  }) {
    const storage = this.requireStorage("EGRESS_START_FAILED");
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: input.objectKey,
      disableManifest: true,
      output: {
        case: "s3",
        value: new S3Upload({
          accessKey: storage.accessKeyId,
          secret: storage.secretAccessKey,
          region: storage.region,
          endpoint: storage.endpoint,
          bucket: storage.bucket,
          forcePathStyle: true,
        }),
      },
    });
    const info = await this.call("EGRESS_START_FAILED", () =>
      this.egress().startRoomCompositeEgress(input.roomName, output, {
        layout: "speaker",
        audioOnly: input.kind === "AUDIO_ONLY",
      }),
    );
    return { egressId: info.egressId };
  }

  async stop(egressId: string) {
    await this.call("EGRESS_STOP_FAILED", () =>
      this.egress().stopEgress(egressId),
    );
  }

  async list(roomName: string) {
    const items = await this.call("EGRESS_LIST_FAILED", () =>
      this.egress().listEgress({ roomName }),
    );
    return items.map(egressSnapshot);
  }

  /** The room indicator both clients show; null clears it. */
  async setIndicator(
    roomName: string,
    recording: { id: string; kind: RecordingKind } | null,
  ) {
    const config = this.requireLiveKit("ROOM_METADATA_FAILED");
    const rooms = new RoomServiceClient(
      config.url.replace(/^ws/, "http"),
      config.apiKey,
      config.apiSecret,
      { requestTimeout: 5, failover: false },
    );
    await this.call("ROOM_METADATA_FAILED", () =>
      rooms.updateRoomMetadata(roomName, JSON.stringify({ recording })),
    );
  }

  private egress() {
    const config = this.requireLiveKit("EGRESS_START_FAILED");
    return new EgressClient(
      config.url.replace(/^ws/, "http"),
      config.apiKey,
      config.apiSecret,
      { requestTimeout: 10, failover: false },
    );
  }

  private requireLiveKit(code: RecordingProviderError["code"]) {
    const config = this.livekit.config;
    if (!config.enabled) throw new RecordingProviderError(code);
    return config;
  }

  private requireStorage(code: RecordingProviderError["code"]) {
    if (!this.storage.enabled) throw new RecordingProviderError(code);
    return this.storage;
  }

  private async call<T>(
    code: RecordingProviderError["code"],
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof RecordingProviderError) throw error;
      // Log the code and error class only: provider messages may include credentials.
      this.logger.warn(
        `${code}: ${error instanceof Error ? error.name : "unknown"}`,
      );
      throw new RecordingProviderError(code);
    }
  }
}
