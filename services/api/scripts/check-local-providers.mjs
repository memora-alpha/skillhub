import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { createConnection } from "node:net";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";

process.loadEnvFile();
const summary = {
  fileStorageEnabled: process.env.STORAGE_ENABLED === "true",
  bucket: process.env.S3_BUCKET ?? null,
};
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  maxAttempts: 1,
});
try {
  const result = await client.send(
    new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }),
    { abortSignal: AbortSignal.timeout(10000) },
  );
  summary.s3Bucket = { ok: true, status: result.$metadata.httpStatusCode };
} catch (error) {
  summary.s3Bucket = {
    ok: false,
    code: error.name,
    status: error.$metadata?.httpStatusCode ?? null,
  };
} finally {
  client.destroy();
}

// Read-only protocol probe; no file upload or malware-scan request.
summary.scanner = await new Promise((resolve) => {
  const socket = createConnection({
    host: process.env.CLAMAV_HOST,
    port: Number(process.env.CLAMAV_PORT),
  });
  let response = "";
  const finish = (result) => {
    socket.destroy();
    resolve(result);
  };
  socket.setTimeout(5000, () => finish({ ok: false, code: "TIMEOUT" }));
  socket.once("error", (error) => finish({ ok: false, code: error.code }));
  socket.once("connect", () => socket.write("zPING\0"));
  socket.on("data", (chunk) => {
    response += chunk.toString();
    if (response.includes("PONG")) finish({ ok: true, response: "PONG" });
    else if (response.length > 1024 || /[\n\0]/.test(response))
      finish({ ok: false, code: "UNEXPECTED_SCANNER_REPLY" });
  });
  socket.once("end", () =>
    finish({ ok: false, code: "SCANNER_CLOSED_WITHOUT_PONG" }),
  );
});
if (process.argv.includes("--scan-sample") && summary.scanner.ok) {
  const { ClamAvScanner } =
    await import("../dist/infrastructure/storage/clamav-scanner.adapter.js");
  const body = Buffer.from("SkillHub local scanner check.\n");
  const scanner = new ClamAvScanner({
    host: process.env.CLAMAV_HOST,
    port: Number(process.env.CLAMAV_PORT),
    timeoutMs: 30000,
    maxBytes: 15000000,
  });
  // Harmless in-memory text only; no S3 upload or application database writes.
  summary.scanner.sampleScan = await scanner.scan({
    body: Readable.from([body]),
    expectedSha256: createHash("sha256").update(body).digest("hex"),
  });
}
console.log(JSON.stringify(summary, null, 2));
