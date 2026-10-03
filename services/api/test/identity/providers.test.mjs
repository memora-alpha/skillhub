import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer as httpServer } from "node:http";
import { createServer as tcpServer } from "node:net";
import { ConfigService } from "@nestjs/config";
import { AvatarStorage } from "../../dist/infrastructure/storage/avatar-storage.js";
import { AvatarScanner } from "../../dist/infrastructure/storage/avatar-scanner.js";
import { SmtpAdapter } from "../../dist/infrastructure/email/smtp.adapter.js";

const listen = (server) =>
  new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server) => new Promise((resolve) => server.close(resolve));

test("actual S3 adapter signs private upload/read/delete and never uses a public ACL", async () => {
  const objects = new Map();
  const requests = [];
  const server = httpServer(async (req, res) => {
    requests.push({
      method: req.method,
      auth: req.headers.authorization,
      acl: req.headers["x-amz-acl"],
    });
    const key = req.url.split("?")[0];
    if (req.method === "PUT") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      objects.set(key, Buffer.concat(chunks));
      res.end();
    } else if (req.method === "GET") {
      const data = objects.get(key);
      if (!data) {
        res.statusCode = 404;
        res.end();
      } else {
        res.setHeader("Content-Length", data.length);
        res.end(data);
      }
    } else if (req.method === "DELETE") {
      objects.delete(key);
      res.statusCode = 204;
      res.end();
    }
  });
  await listen(server);
  try {
    const storage = new AvatarStorage(
      new ConfigService({
        NODE_ENV: "test",
        S3_ENDPOINT: `http://127.0.0.1:${server.address().port}`,
        S3_REGION: "fixture",
        S3_AVATAR_BUCKET: "avatars",
        S3_ACCESS_KEY: "fixture",
        S3_SECRET_KEY: "fixture-secret",
      }),
    );
    await storage.put(
      "avatars/user/image",
      Buffer.from("image-bytes"),
      "image/png",
    );
    assert.equal(
      (await storage.read("avatars/user/image")).toString(),
      "image-bytes",
    );
    assert.match(await storage.url("avatars/user/image"), /X-Amz-Signature=/);
    await storage.remove("avatars/user/image");
    assert.equal(objects.size, 0);
    assert.ok(
      requests.every(
        (req) => req.auth?.startsWith("AWS4-HMAC-SHA256") && !req.acl,
      ),
    );
  } finally {
    server.closeAllConnections();
    await close(server);
  }
});

test("actual ClamAV INSTREAM adapter validates clean/infected/failure replies", async () => {
  let answer = "stream: OK\0";
  let received = Buffer.alloc(0);
  const server = tcpServer((socket) => {
    let bytes = Buffer.alloc(0);
    let body = Buffer.alloc(0);
    let command = false;
    socket.on("data", (chunk) => {
      bytes = Buffer.concat([bytes, chunk]);
      if (!command) {
        const end = bytes.indexOf(0);
        if (end < 0) return;
        assert.equal(bytes.subarray(0, end).toString(), "zINSTREAM");
        bytes = bytes.subarray(end + 1);
        command = true;
      }
      while (bytes.length >= 4) {
        const size = bytes.readUInt32BE();
        if (bytes.length < 4 + size) return;
        if (size === 0) {
          received = body;
          socket.end(answer);
          return;
        }
        body = Buffer.concat([body, bytes.subarray(4, 4 + size)]);
        bytes = bytes.subarray(4 + size);
      }
    });
  });
  await listen(server);
  try {
    const scanner = new AvatarScanner(
      new ConfigService({
        CLAMAV_HOST: "127.0.0.1",
        CLAMAV_PORT: server.address().port,
      }),
    );
    const bytes = Buffer.alloc(70000, 1);
    assert.equal(await scanner.scan(bytes), true);
    assert.deepEqual(received, bytes);
    answer = "stream: Eicar-Test-Signature FOUND\0";
    assert.equal(await scanner.scan(bytes), false);
    answer = "UNKNOWN COMMAND\0";
    await assert.rejects(scanner.scan(bytes));
  } finally {
    await close(server);
  }
});

test("actual SMTP adapter sends to controlled local mailbox and rejects refusal", async () => {
  const messages = [];
  let rejectRecipient = false;
  const server = tcpServer((socket) => {
    socket.write("220 fixture ESMTP\r\n");
    let pending = "";
    let data = false;
    let content = "";
    socket.on("data", (bytes) => {
      pending += bytes.toString();
      while (pending.includes("\r\n")) {
        const end = pending.indexOf("\r\n");
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (data) {
          if (line === ".") {
            messages.push(content);
            data = false;
            content = "";
            socket.write("250 accepted\r\n");
          } else content += `${line}\r\n`;
        } else if (/^EHLO/.test(line))
          socket.write("250-fixture\r\n250 OK\r\n");
        else if (/^MAIL/.test(line)) socket.write("250 OK\r\n");
        else if (/^RCPT/.test(line))
          socket.write(rejectRecipient ? "550 refused\r\n" : "250 OK\r\n");
        else if (line === "DATA") {
          data = true;
          socket.write("354 continue\r\n");
        } else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await listen(server);
  const smtp = new SmtpAdapter(
    new ConfigService({
      NODE_ENV: "test",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: server.address().port,
      SMTP_SECURE: "false",
      SMTP_FROM: "fixture@example.com",
    }),
  );
  try {
    await smtp.send(
      "fixture-id",
      "recipient@example.com",
      "REGISTER_OTP",
      "000012",
    );
    assert.equal(messages.length, 1);
    assert.ok(messages[0].includes("000012"));
    assert.ok(messages[0].includes("<fixture-id@skillhub>"));
    rejectRecipient = true;
    await assert.rejects(
      smtp.send("rejected", "recipient@example.com", "RESET_OTP", "000012"),
    );
  } finally {
    smtp.onModuleDestroy();
    await close(server);
  }
});
