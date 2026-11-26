import { createHash } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import type { Readable } from "node:stream";
import type { MalwareScanner, ScanVerdict } from "./malware-scanner.port";
import { Logger } from "@nestjs/common";

type ClamAvOptions = {
  host: string;
  port: number;
  timeoutMs?: number;
  maxBytes: number;
};

async function connect(
  options: ClamAvOptions,
  signal?: AbortSignal,
): Promise<Socket> {
  signal?.throwIfAborted();
  const socket = createConnection({
    host: options.host,
    port: options.port,
    signal,
  });
  socket.setTimeout(options.timeoutMs ?? 30_000, () =>
    socket.destroy(new Error("SCANNER_TIMEOUT")),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    return socket;
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

function response(socket: Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    let length = 0;
    const onData = (chunk: Buffer) => {
      length += chunk.length;
      if (length > 4_096) {
        socket.destroy(new Error("SCANNER_RESPONSE_TOO_LARGE"));
        return;
      }
      parts.push(chunk);
      const combined = Buffer.concat(parts);
      const end = combined.indexOf(0);
      if (end >= 0) {
        cleanup();
        resolve(combined.subarray(0, end).toString("utf8"));
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error("SCANNER_CLOSED"));
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function write(socket: Socket, chunk: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    socket.write(chunk, (error) => (error ? reject(error) : resolve()));
  });
}

export class ClamAvScanner implements MalwareScanner {
  private readonly logger = new Logger(ClamAvScanner.name);
  private readonly clean = new Map<string, number>();
  constructor(private readonly options: ClamAvOptions) {
    if (
      !options.host ||
      !Number.isInteger(options.port) ||
      options.port < 1 ||
      options.port > 65535 ||
      !Number.isSafeInteger(options.maxBytes) ||
      options.maxBytes <= 0
    ) {
      throw new Error("Invalid ClamAV scanner configuration");
    }
  }

  async scan(input: {
    body: Readable;
    expectedSha256: string;
    signal?: AbortSignal;
  }): Promise<{ verdict: ScanVerdict; scannerVersion: string }> {
    let scannerVersion = "unavailable";
    try {
      const started = performance.now();
      scannerVersion = await this.version(input.signal);
      const versionMs = Math.round(performance.now() - started);
      const cacheKey = `${scannerVersion}:${input.expectedSha256}`;
      const hasSignature = /^ClamAV [^/]+\/\d+\//u.test(scannerVersion);
      const cached =
        hasSignature && (this.clean.get(cacheKey) ?? 0) > Date.now();
      this.logger.log({
        clamav_version_duration_ms: versionMs,
        malware_cache_hit: cached,
      });
      if (cached) {
        const hash = createHash("sha256");
        let size = 0;
        for await (const chunk of input.body) {
          input.signal?.throwIfAborted();
          size += (chunk as Buffer).length;
          if (size > this.options.maxBytes)
            return { verdict: "UNKNOWN", scannerVersion };
          hash.update(chunk as Buffer);
        }
        const verified =
          size > 0 && hash.digest("hex") === input.expectedSha256;
        return { verdict: verified ? "CLEAN" : "UNKNOWN", scannerVersion };
      }

      const socket = await connect(this.options, input.signal);
      try {
        const scanReply = response(socket);
        // Attach a handler before streaming; an early daemon error must not become unhandled.
        void scanReply.catch(() => undefined);
        await write(socket, Buffer.from("zINSTREAM\0"));
        const hash = createHash("sha256");
        let bytes = 0;
        for await (const value of input.body) {
          const chunk = Buffer.isBuffer(value)
            ? value
            : Buffer.from(value as Uint8Array);
          bytes += chunk.length;
          if (bytes > this.options.maxBytes)
            return { verdict: "UNKNOWN", scannerVersion };
          hash.update(chunk);
          const length = Buffer.allocUnsafe(4);
          length.writeUInt32BE(chunk.length);
          await write(socket, length);
          await write(socket, chunk);
        }
        await write(socket, Buffer.alloc(4));
        const reply = await scanReply;
        if (bytes === 0 || hash.digest("hex") !== input.expectedSha256)
          return { verdict: "UNKNOWN", scannerVersion };
        if (reply === "stream: OK") {
          const stableVersion =
            !hasSignature ||
            scannerVersion ===
              (await this.version(input.signal).catch(() => undefined));
          if (hasSignature && stableVersion) {
            if (this.clean.size >= 4_096) {
              const oldest = this.clean.keys().next().value;
              if (oldest) this.clean.delete(oldest);
            }
            this.clean.set(cacheKey, Date.now() + 86_400_000);
          }
          return {
            verdict: "CLEAN",
            scannerVersion: stableVersion
              ? scannerVersion
              : "signature-changed-during-scan",
          };
        }
        if (/^stream: .+ FOUND$/u.test(reply))
          return { verdict: "INFECTED", scannerVersion };
        return { verdict: "UNKNOWN", scannerVersion };
      } finally {
        socket.destroy();
      }
    } catch {
      return { verdict: "UNKNOWN", scannerVersion };
    }
  }

  private async version(signal?: AbortSignal) {
    const socket = await connect(this.options, signal);
    try {
      const versionReply = response(socket);
      void versionReply.catch(() => undefined);
      await write(socket, Buffer.from("zVERSION\0"));
      const version = await versionReply;
      if (!/^ClamAV \S+/u.test(version))
        throw new Error("SCANNER_VERSION_INVALID");
      return version;
    } finally {
      socket.destroy();
    }
  }
}
