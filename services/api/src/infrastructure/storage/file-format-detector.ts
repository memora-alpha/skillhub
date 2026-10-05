import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInflateRaw } from "node:zlib";
import * as CFB from "cfb";
import { FileStorageError, type FilePurpose } from "./file.types";
import { validateFile } from "./file-policy";

const MAX_ENTRIES = 1_000;
const MAX_CENTRAL_DIRECTORY = 512_000;
const MAX_EXPANDED = 100_000_000;

type ZipEntry = {
  name: string;
  method: number;
  compressed: number;
  expanded: number;
  localOffset: number;
};

async function readAt(
  path: string,
  start: number,
  length: number,
): Promise<Buffer> {
  const handle = await open(path, "r");
  try {
    const result = Buffer.alloc(length);
    const { bytesRead } = await handle.read(result, 0, length, start);
    if (bytesRead !== length)
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    return result;
  } finally {
    await handle.close();
  }
}

async function inspectZip(path: string, size: number): Promise<string> {
  const tailSize = Math.min(size, 65_557);
  const tail = await readAt(path, size - tailSize, tailSize);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (
      tail.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + tail.readUInt16LE(i + 20) === tail.length
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
  const count = tail.readUInt16LE(eocd + 10);
  const centralSize = tail.readUInt32LE(eocd + 12);
  const centralOffset = tail.readUInt32LE(eocd + 16);
  if (
    count === 0 ||
    count > MAX_ENTRIES ||
    centralSize > MAX_CENTRAL_DIRECTORY ||
    centralOffset + centralSize > size ||
    tail.readUInt16LE(eocd + 8) !== count ||
    tail.readUInt16LE(eocd + 4) !== 0 ||
    tail.readUInt16LE(eocd + 6) !== 0
  ) {
    throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
  }
  const central = await readAt(path, centralOffset, centralSize);
  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let offset = 0;
  let expandedTotal = 0;
  for (let i = 0; i < count; i++) {
    if (
      offset + 46 > central.length ||
      central.readUInt32LE(offset) !== 0x02014b50
    ) {
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    }
    const flags = central.readUInt16LE(offset + 8);
    const method = central.readUInt16LE(offset + 10);
    const compressed = central.readUInt32LE(offset + 20);
    const expanded = central.readUInt32LE(offset + 24);
    const nameLength = central.readUInt16LE(offset + 28);
    const extraLength = central.readUInt16LE(offset + 30);
    const commentLength = central.readUInt16LE(offset + 32);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (
      end > central.length ||
      flags & 1 ||
      (method !== 0 && method !== 8) ||
      compressed === 0xffffffff ||
      expanded === 0xffffffff
    ) {
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    }
    const name = central
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    if (
      !name ||
      name.includes("\\") ||
      name.startsWith("/") ||
      name.split("/").includes("..") ||
      names.has(name)
    ) {
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    }
    names.add(name);
    expandedTotal += expanded;
    if (expandedTotal > Math.min(MAX_EXPANDED, size * 10)) {
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    }
    entries.push({
      name,
      method,
      compressed,
      expanded,
      localOffset: central.readUInt32LE(offset + 42),
    });
    offset = end;
  }
  if (
    offset !== central.length ||
    !names.has("[Content_Types].xml") ||
    !names.has("_rels/.rels")
  ) {
    throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
  }
  const variants = [
    {
      main: "word/document.xml",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
    },
    {
      main: "xl/workbook.xml",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
    },
    {
      main: "ppt/presentation.xml",
      mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
    },
  ].filter((variant) => names.has(variant.main));
  if (
    variants.length !== 1 ||
    [...names].some((name) => /(^|\/)vbaProject\.bin$/i.test(name))
  ) {
    throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
  }
  let contentTypes = "";
  let relationships = "";
  for (const entry of entries) {
    const local = await readAt(path, entry.localOffset, 30);
    if (
      local.readUInt32LE(0) !== 0x04034b50 ||
      local.readUInt16LE(8) !== entry.method
    ) {
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    }
    const start =
      entry.localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
    if (start + entry.compressed > centralOffset)
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    let actual = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        actual += chunk.length;
        if (actual > entry.expanded)
          callback(new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415));
        else callback(null, chunk);
      },
    });
    const capture =
      entry.name === "[Content_Types].xml" || entry.name === "_rels/.rels";
    if (capture && entry.expanded > 256_000)
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    const chunks: Buffer[] = [];
    const sink = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        if (capture) chunks.push(chunk);
        callback();
      },
    });
    if (entry.compressed > 0) {
      const source = createReadStream(path, {
        start,
        end: start + entry.compressed - 1,
      });
      try {
        if (entry.method === 8)
          await pipeline(source, createInflateRaw(), meter, sink);
        else await pipeline(source, meter, sink);
      } catch {
        throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
      }
    }
    if (actual !== entry.expanded)
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    if (capture) {
      let xml: string;
      try {
        xml = new TextDecoder("utf-8", { fatal: true }).decode(
          Buffer.concat(chunks),
        );
      } catch {
        throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
      }
      if (/<!DOCTYPE|<!ENTITY/iu.test(xml))
        throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
      if (entry.name === "[Content_Types].xml") contentTypes = xml;
      else relationships = xml;
    }
  }
  const variant = variants[0]!;
  const hasOverride = [...contentTypes.matchAll(/<Override\b[^>]*>/gu)].some(
    ([tag]) =>
      tag.includes(`/${variant.main}`) && tag.includes(variant.contentType),
  );
  const hasRootRelation = [
    ...relationships.matchAll(/<Relationship\b[^>]*>/gu),
  ].some(
    ([tag]) => tag.includes("/officeDocument") && tag.includes(variant.main),
  );
  if (!hasOverride || !hasRootRelation)
    throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
  return variant.mime;
}

function inspectOle(path: string, size: number): string {
  try {
    // CFB's parser materializes streams. Input is already capped at 10/15 MB;
    // reject excessive internal entries and extracted bytes immediately after parse.
    const compound = CFB.read(path, { type: "file", WTF: true });
    if (compound.FileIndex.length > MAX_ENTRIES) throw new Error("OLE_ENTRIES");
    const streams = compound.FileIndex.filter((entry) => entry.type === 2);
    const expanded = streams.reduce(
      (sum, entry) => sum + entry.content.length,
      0,
    );
    if (expanded > Math.min(MAX_EXPANDED, size * 10))
      throw new Error("OLE_EXPANDED");
    const byName = new Map(
      streams.map((entry) => [
        entry.name.toLowerCase(),
        Buffer.from(entry.content),
      ]),
    );
    if (
      streams.some((entry) =>
        /(?:encryptedpackage|encryptioninfo|vba|macros)/iu.test(entry.name),
      )
    ) {
      throw new Error("OLE_ENCRYPTED_OR_MACRO");
    }
    const variants = [
      byName.has("worddocument") &&
      (byName.has("0table") || byName.has("1table"))
        ? "doc"
        : null,
      byName.has("workbook") || byName.has("book") ? "xls" : null,
      byName.has("powerpoint document") && byName.has("current user")
        ? "ppt"
        : null,
    ].filter(Boolean);
    if (variants.length !== 1) throw new Error("OLE_AMBIGUOUS");
    if (variants[0] === "doc") {
      const word = byName.get("worddocument")!;
      if (
        word.length < 32 ||
        word.readUInt16LE(0) !== 0xa5ec ||
        (word.readUInt16LE(10) & 0x0100) !== 0
      ) {
        throw new Error("WORD_INVALID_OR_ENCRYPTED");
      }
      return "application/msword";
    }
    if (variants[0] === "xls") {
      const workbook = byName.get("workbook") ?? byName.get("book")!;
      if (
        workbook.length < 12 ||
        workbook.readUInt16LE(0) !== 0x0809 ||
        workbook.readUInt16LE(2) < 4 ||
        workbook.readUInt16LE(4) !== 0x0600 ||
        workbook.readUInt16LE(6) !== 0x0005
      )
        throw new Error("XLS_INVALID");
      let cursor = 0;
      let hasEof = false;
      while (cursor + 4 <= workbook.length) {
        const type = workbook.readUInt16LE(cursor);
        const length = workbook.readUInt16LE(cursor + 2);
        cursor += 4 + length;
        if (cursor > workbook.length || type === 0x002f)
          throw new Error("XLS_ENCRYPTED_OR_BROKEN");
        if (type === 0x000a) {
          hasEof = true;
          break;
        }
      }
      if (!hasEof) throw new Error("XLS_NO_EOF");
      return "application/vnd.ms-excel";
    }
    const current = byName.get("current user")!;
    const presentation = byName.get("powerpoint document")!;
    if (
      current.length < 20 ||
      current.readUInt32LE(12) !== 0xe391c05f ||
      presentation.length < 8 ||
      presentation.readUInt32LE(4) > presentation.length - 8
    ) {
      throw new Error("PPT_INVALID_OR_ENCRYPTED");
    }
    return "application/vnd.ms-powerpoint";
  } catch {
    throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
  }
}

async function detect(
  path: string,
  size: number,
  extension: string,
): Promise<string> {
  const head = await readAt(path, 0, Math.min(size, 64));
  const tail = await readAt(
    path,
    Math.max(0, size - 1_024),
    Math.min(size, 1_024),
  );
  if (
    head.subarray(0, 5).toString("ascii") === "%PDF-" &&
    tail.includes(Buffer.from("%%EOF"))
  ) {
    let previous = Buffer.alloc(0);
    for await (const chunk of createReadStream(path, {
      highWaterMark: 64 * 1024,
    })) {
      const content = Buffer.concat([previous, chunk as Buffer]);
      if (/\/Encrypt\b/u.test(content.toString("latin1")))
        throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
      previous = content.subarray(Math.max(0, content.length - 16));
    }
    return "application/pdf";
  }
  if (
    head
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    head.subarray(12, 16).toString("ascii") === "IHDR"
  )
    return "image/png";
  if (
    head[0] === 0xff &&
    head[1] === 0xd8 &&
    head[2] === 0xff &&
    tail[tail.length - 2] === 0xff &&
    tail[tail.length - 1] === 0xd9
  )
    return "image/jpeg";
  if (
    head.subarray(0, 4).toString("ascii") === "RIFF" &&
    head.subarray(8, 12).toString("ascii") === "WEBP" &&
    head.readUInt32LE(4) + 8 === size
  )
    return "image/webp";
  if (head.subarray(0, 4).equals(Buffer.from("PK\u0003\u0004")))
    return inspectZip(path, size);
  // OLE Office needs stream-level parsing. Never accept a generic CFB signature.
  if (
    head
      .subarray(0, 8)
      .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  ) {
    return inspectOle(path, size);
  }
  if (extension === "txt") {
    if (
      /^\s*<\s*(?:!doctype\s+html|html|svg|script)\b/iu.test(
        head.toString("utf8"),
      )
    ) {
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    }
    const decoder = new TextDecoder("utf-8", { fatal: true });
    for await (const chunk of createReadStream(path, {
      highWaterMark: 64 * 1024,
    })) {
      const bytes = chunk as Buffer;
      if (bytes.includes(0))
        throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
      try {
        decoder.decode(bytes, { stream: true });
      } catch {
        throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
      }
    }
    try {
      decoder.decode();
    } catch {
      throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
    }
    return "text/plain";
  }
  throw new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);
}

export class FileFormatDetector {
  async inspect(input: {
    body: Readable;
    name: string;
    purpose: FilePurpose;
    capBytes?: number;
  }): Promise<{
    detectedMime: string;
    sizeBytes: number;
    sha256: string;
  }> {
    const cap = input.purpose === "CHAT" ? 15_000_000 : input.capBytes;
    if (!cap || !Number.isSafeInteger(cap) || cap <= 0)
      throw new FileStorageError("FILE_POLICY_UNAVAILABLE", 503);
    const dir = await mkdtemp(join(tmpdir(), "skillhub-file-"));
    const path = join(dir, "upload");
    const hash = createHash("sha256");
    let sizeBytes = 0;
    try {
      const meter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          sizeBytes += chunk.length;
          if (sizeBytes > cap)
            callback(new FileStorageError("FILE_TOO_LARGE", 413));
          else {
            hash.update(chunk);
            callback(null, chunk);
          }
        },
      });
      await pipeline(
        input.body,
        meter,
        createWriteStream(path, { flags: "wx", mode: 0o600 }),
      );
      if (sizeBytes === 0)
        throw new FileStorageError("FILE_EMPTY_OR_INVALID", 400);
      const extension = input.name.split(".").at(-1)?.toLowerCase() ?? "";
      const detectedMime = await detect(path, sizeBytes, extension);
      // Final policy validation is repeated by the caller with claimed MIME.
      validateFile({
        ...input,
        claimedMime: detectedMime,
        detectedMime,
        sizeBytes,
      });
      return { detectedMime, sizeBytes, sha256: hash.digest("hex") };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
