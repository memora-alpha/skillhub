import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
} from "livekit-server-sdk";

export type LiveKitConfiguration =
  | { enabled: false }
  | {
      enabled: true;
      url: string;
      apiKey: string;
      apiSecret: string;
    };

export function liveKitConfiguration(
  input: Record<string, unknown>,
): LiveKitConfiguration {
  const keys = [
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
  ] as const;
  if (keys.every((key) => input[key] === undefined)) return { enabled: false };
  const invalid = keys.filter(
    (key) => typeof input[key] !== "string" || !(input[key] as string).trim(),
  );
  const rawUrl = input.LIVEKIT_URL;
  if (typeof rawUrl === "string" && URL.canParse(rawUrl)) {
    const url = new URL(rawUrl);
    const local =
      input.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !(url.protocol === "wss:" || (local && url.protocol === "ws:"))
    )
      invalid.push("LIVEKIT_URL");
  } else invalid.push("LIVEKIT_URL");
  if (invalid.length)
    throw new Error(
      `Invalid LiveKit configuration: ${[...new Set(invalid)].join(", ")}`,
    );
  return {
    enabled: true,
    url: rawUrl as string,
    apiKey: input.LIVEKIT_API_KEY as string,
    apiSecret: input.LIVEKIT_API_SECRET as string,
  };
}

@Injectable()
export class LiveKitService {
  readonly config: LiveKitConfiguration;
  constructor(config: ConfigService) {
    this.config = liveKitConfiguration(
      Object.fromEntries(
        [
          "NODE_ENV",
          "LIVEKIT_URL",
          "LIVEKIT_API_KEY",
          "LIVEKIT_API_SECRET",
        ].map((key) => [key, config.get(key)]),
      ),
    );
  }

  issueParticipantToken(input: {
    roomName: string;
    identity: string;
    expiresAt: Date;
  }) {
    const config = this.requireEnabled();
    const token = new AccessToken(config.apiKey, config.apiSecret, {
      identity: input.identity,
    });
    // The SDK passes its public ttl to jose.setExpirationTime; a number is an absolute epoch.
    token.ttl = Math.floor(input.expiresAt.getTime() / 1000);
    token.addGrant({
      roomJoin: true,
      room: input.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });
    return token.toJwt();
  }

  async verifyWebhook(rawBody: string, authorization: string) {
    const config = this.requireEnabled();
    try {
      return await new WebhookReceiver(config.apiKey, config.apiSecret).receive(
        rawBody,
        authorization,
      );
    } catch {
      throw new UnauthorizedException("INVALID_LIVEKIT_WEBHOOK");
    }
  }

  async listActiveParticipants(roomName: string) {
    const config = this.requireEnabled();
    const client = new RoomServiceClient(
      config.url.replace(/^ws/, "http"),
      config.apiKey,
      config.apiSecret,
      { requestTimeout: 5, failover: false },
    );
    const rooms = await client.listRooms([roomName]);
    if (!rooms.length) return null;
    const participants = await client.listParticipants(roomName);
    return {
      roomSid: rooms[0]!.sid,
      identities: participants
        .filter((p) => p.state === 2)
        .map((p) => p.identity),
    };
  }

  private requireEnabled() {
    if (!this.config.enabled)
      throw new ServiceUnavailableException("LIVEKIT_DISABLED");
    return this.config;
  }
}
