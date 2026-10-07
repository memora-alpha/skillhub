import assert from "node:assert/strict";
import { createServer } from "node:net";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import test from "node:test";
import { ClamAvScanner } from "../dist/infrastructure/storage/clamav-scanner.adapter.js";

async function withClamd(reply, run) {
  const server = createServer((socket) => {
    let command = Buffer.alloc(0);
    socket.on("data", (data) => {
      command = Buffer.concat([command, data]);
      if (command.subarray(0, 9).toString() === "zVERSION\0") {
        socket.end("ClamAV 1.4/test\0");
      } else if (
        command.subarray(0, 10).toString() === "zINSTREAM\0" &&
        command.subarray(-4).equals(Buffer.alloc(4))
      ) {
        socket.end(`${reply}\0`);
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const data = Buffer.from("a clean fixture");
const sha256 = createHash("sha256").update(data).digest("hex");

test("ClamAV clean verdict requires matching object hash", async () => {
  await withClamd("stream: OK", async (port) => {
    const scanner = new ClamAvScanner({
      host: "127.0.0.1",
      port,
      timeoutMs: 2_000,
      maxBytes: 15_000_000,
    });
    assert.deepEqual(
      await scanner.scan({
        body: Readable.from([data]),
        expectedSha256: sha256,
      }),
      { verdict: "CLEAN", scannerVersion: "ClamAV 1.4/test" },
    );
    assert.equal(
      (
        await scanner.scan({
          body: Readable.from([data]),
          expectedSha256: "0".repeat(64),
        })
      ).verdict,
      "UNKNOWN",
    );
  });
});

test("infected and scanner error are never clean", async () => {
  for (const [reply, expected] of [
    ["stream: Eicar-Test-Signature FOUND", "INFECTED"],
    ["INSTREAM size limit exceeded. ERROR", "UNKNOWN"],
  ]) {
    await withClamd(reply, async (port) => {
      const scanner = new ClamAvScanner({
        host: "127.0.0.1",
        port,
        timeoutMs: 2_000,
        maxBytes: 15_000_000,
      });
      assert.equal(
        (
          await scanner.scan({
            body: Readable.from([data]),
            expectedSha256: sha256,
          })
        ).verdict,
        expected,
      );
    });
  }
});
