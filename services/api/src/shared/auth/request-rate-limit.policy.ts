import { BadRequestException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import type { Request } from "express";

export type RequestRiskGroup = "DEFAULT" | "AUTH" | "PAYMENT" | "UPLOAD";

export type RequestRateDimension = {
  kind: "network" | "session" | "device";
  value: string;
  limit: number;
};

const visibleDevice = /^[\x21-\x7e]{1,128}$/u;

export function requestRiskGroup(
  method: string,
  path: string,
): RequestRiskGroup {
  const normalized = path.split("?", 1)[0]?.toLowerCase() ?? "";
  if (normalized.includes("/auth/") || normalized.endsWith("/auth"))
    return "AUTH";
  if (normalized.includes("/payments") || normalized.includes("/credit"))
    return "PAYMENT";
  if (
    method.toUpperCase() === "POST" &&
    (normalized.includes("/files") || normalized.includes("/attachments"))
  )
    return "UPLOAD";
  return "DEFAULT";
}

export function requestRateDimensions(
  request: Pick<Request, "headers" | "ip" | "method" | "originalUrl" | "url">,
  options: { requestLimit: number; deviceHmacKey: string },
): { group: RequestRiskGroup; dimensions: RequestRateDimension[] } {
  const group = requestRiskGroup(
    request.method,
    request.originalUrl || request.url,
  );
  const groupLimit = riskLimit(options.requestLimit, group);
  const network = request.ip?.trim() || "unknown";
  const deviceHeader = singleHeader(request.headers["x-device-id"]);
  if (deviceHeader !== undefined && !visibleDevice.test(deviceHeader))
    throw new BadRequestException("DEVICE_ID_INVALID");
  const userAgent = singleHeader(request.headers["user-agent"]) ?? "unknown";
  const device =
    deviceHeader ??
    `ua:${createHmac("sha256", options.deviceHmacKey)
      .update(userAgent.trim().toLowerCase().slice(0, 512))
      .digest("hex")}`;
  const session = bearerSession(singleHeader(request.headers.authorization));
  return {
    group,
    dimensions: [
      { kind: "network", value: network, limit: groupLimit * 10 },
      ...(session
        ? ([{ kind: "session", value: session, limit: groupLimit }] as const)
        : []),
      { kind: "device", value: device, limit: groupLimit * 2 },
    ],
  };
}

function riskLimit(base: number, group: RequestRiskGroup) {
  if (group === "AUTH") return Math.max(1, Math.floor(base / 4));
  if (group === "PAYMENT" || group === "UPLOAD")
    return Math.max(1, Math.floor(base / 2));
  return base;
}

function singleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function bearerSession(authorization: string | undefined): string | null {
  const token = authorization?.match(/^Bearer ([^.]+)\.([^.]+)\.[^.]+$/u)?.[2];
  if (!token) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token, "base64url").toString("utf8"),
    ) as {
      sid?: unknown;
    };
    return typeof payload.sid === "string" && payload.sid.length <= 128
      ? payload.sid
      : null;
  } catch {
    return null;
  }
}
