import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true });
const serverUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const development = typeof __DEV__ !== "undefined" && __DEV__;
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "wss:" ||
        (development && local && url.protocol === "ws:"))
    );
  });

export const liveKitTokenSchema = z
  .object({
    serverUrl,
    participantToken: z.string().min(1),
    roomName: z.string().min(1),
    participantIdentity: z.string().min(1),
    expiresAt: timestamp,
    joinOpensAt: timestamp,
    joinClosesAt: timestamp,
  })
  .refine(
    (value) =>
      Date.parse(value.joinOpensAt) < Date.parse(value.joinClosesAt) &&
      Date.parse(value.expiresAt) > Date.parse(value.joinOpensAt) &&
      Date.parse(value.expiresAt) <= Date.parse(value.joinClosesAt),
  );
export type LiveKitCredentials = z.infer<typeof liveKitTokenSchema>;
