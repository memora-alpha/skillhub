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
const MAX_CAPTURED_XML = 256_000;
const CONTENT_TYPES = "[Content_Types].xml";
const ROOT_RELATIONSHIPS = "_rels/.rels";
const READ_CHUNK = 64 * 1024;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ZIP_SIGNATURE = Buffer.from("PK\u0003\u0004");
const OLE_SIGNATURE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);

const OOXML_VARIANTS = [
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
] as const;

type OoxmlVariant = (typeof OOXML_VARIANTS)[number];

type ZipEntry = {
  name: string;
  method: number;
  compressed: number;
  expanded: number;
  localOffset: number;
};

type CentralDirectory = {
  entries: ZipEntry[];
  names: Set<string>;
  centralOffset: number;
};

const unsupported = () => new FileStorageError("FILE_FORMAT_UNSUPPORTED", 415);

const ascii = (bytes: Buffer, start: number, end: number) =>
  bytes.subarray(start, end).toString("ascii");

async function readAt(
  path: string,
  start: number,
  length: number,
): Promise<Buffer> {
  const handle = await open(path, "r");
  try {
    const result = Buffer.alloc(length);
    const { bytesRead } = await handle.read(result, 0, length, start);
    if (bytesRead !== length) throw unsupported();
    return result;
  } finally {
    await handle.close();
  }
}

function findEndOfCentralDirectory(tail: Buffer): number {
  for (let i = tail.length - 22; i >= 0; i--) {
    if (
      tail.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + tail.readUInt16LE(i + 20) === tail.length
    )
      return i;
  }
  throw unsupported();
}

function isUnsafeEntryName(name: string): boolean {
  return (
    !name ||
    name.includes("\\") ||
    name.startsWith("/") ||
    name.split("/").includes("..")
  );
}

/** Parses the central-directory record at `offset`; `end` is where the next record starts. */
function parseCentralEntry(
  central: Buffer,
  offset: number,
): { entry: ZipEntry; end: number } {
  if (
    offset + 46 > central.length ||
    central.readUInt32LE(offset) !== 0x02014b50
  )
    throw unsupported();
  const method = central.readUInt16LE(offset + 10);
  const compressed = central.readUInt32LE(offset + 20);
  const expanded = central.readUInt32LE(offset + 24);
  const nameLength = central.readUInt16LE(offset + 28);
  const end =
    offset +
    46 +
    nameLength +
    central.readUInt16LE(offset + 30) +
    central.readUInt16LE(offset + 32);
  const encrypted = (central.readUInt16LE(offset + 8) & 1) !== 0;
  const storedOrDeflated = method === 0 || method === 8;
  const zip64 = compressed === 0xffffffff || expanded === 0xffffffff;
  if (end > central.length || encrypted || !storedOrDeflated || zip64)
    throw unsupported();
  const name = central
    .subarray(offset + 46, offset + 46 + nameLength)
    .toString("utf8");
  if (isUnsafeEntryName(name)) throw unsupported();
  return {
    entry: {
      name,
      method,
      compressed,
      expanded,
      localOffset: central.readUInt32LE(offset + 42),
    },
    end,
  };
}

/** Reads and bounds the central directory: entry count, directory size and total expanded bytes. */
async function readCentralDirectory(
  path: string,
  size: number,
): Promise<CentralDirectory> {
  const tailSize = Math.min(size, 65_557);
  const tail = await readAt(path, size - tailSize, tailSize);
  const eocd = findEndOfCentralDirectory(tail);
  const count = tail.readUInt16LE(eocd + 10);
  const centralSize = tail.readUInt32LE(eocd + 12);
  const centralOffset = tail.readUInt32LE(eocd + 16);
  const withinLimits =
    count > 0 &&
    count <= MAX_ENTRIES &&
    centralSize <= MAX_CENTRAL_DIRECTORY &&
    centralOffset + centralSize <= size;
  const singleDisk =
    tail.readUInt16LE(eocd + 8) === count &&
    tail.readUInt16LE(eocd + 4) === 0 &&
    tail.readUInt16LE(eocd + 6) === 0;
  if (!withinLimits || !singleDisk) throw unsupported();

  const central = await readAt(path, centralOffset, centralSize);
  const expandedLimit = Math.min(MAX_EXPANDED, size * 10);
  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let offset = 0;
  let expandedTotal = 0;
  for (let i = 0; i < count; i++) {
    const { entry, end } = parseCentralEntry(central, offset);
    expandedTotal += entry.expanded;
    if (names.has(entry.name) || expandedTotal > expandedLimit)
      throw unsupported();
    names.add(entry.name);
    entries.push(entry);
    offset = end;
  }
  if (offset !== central.length) throw unsupported();
  return { entries, names, centralOffset };
}

/** Exactly one Office main part, both package parts present, and no macro project. */
function selectOoxmlVariant(names: Set<string>): OoxmlVariant {
  const variants = OOXML_VARIANTS.filter((variant) => names.has(variant.main));
  const hasMacro = [...names].some((name) =>
    /(^|\/)vbaProject\.bin$/i.test(name),
  );
  const [variant] = variants;
  if (
    !variant ||
    variants.length !== 1 ||
    hasMacro ||
    !names.has(CONTENT_TYPES) ||
    !names.has(ROOT_RELATIONSHIPS)
  )
    throw unsupported();
  return variant;
}

function decodeXml(bytes: Buffer): string {
  let xml: string;
  try {
    xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw unsupported();
  }
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw unsupported();
  return xml;
}

/**
 * Checks one entry against its local header and declared expanded size.
 * Returns the XML of the two package parts that are inspected, otherwise undefined.
 */
async function readEntry(
  path: string,
  entry: ZipEntry,
  centralOffset: number,
): Promise<string | undefined> {
  const local = await readAt(path, entry.localOffset, 30);
  if (
    local.readUInt32LE(0) !== 0x04034b50 ||
    local.readUInt16LE(8) !== entry.method
  )
    throw unsupported();
  const start =
    entry.localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
  const capture =
    entry.name === CONTENT_TYPES || entry.name === ROOT_RELATIONSHIPS;
  const oversizedCapture = capture && entry.expanded > MAX_CAPTURED_XML;
  if (start + entry.compressed > centralOffset || oversizedCapture)
    throw unsupported();

  const chunks: Buffer[] = [];
  let actual = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      actual += chunk.length;
      if (actual > entry.expanded) callback(unsupported());
      else callback(null, chunk);
    },
  });
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
      throw unsupported();
    }
  }
  if (actual !== entry.expanded) throw unsupported();
  return capture ? decodeXml(Buffer.concat(chunks)) : undefined;
}

async function inspectZip(path: string, size: number): Promise<string> {
  const { entries, names, centralOffset } = await readCentralDirectory(
    path,
    size,
  );
  const variant = selectOoxmlVariant(names);
  const captured = new Map<string, string>();
  // Sequential on purpose: up to 1,000 entries of an untrusted archive, with one
  // file handle and one inflater open at a time.
  for (const entry of entries) {
    const xml = await readEntry(path, entry, centralOffset);
    if (xml !== undefined) captured.set(entry.name, xml);
  }
  const contentTypes = captured.get(CONTENT_TYPES) ?? "";
  const relationships = captured.get(ROOT_RELATIONSHIPS) ?? "";
  const hasOverride = [...contentTypes.matchAll(/<Override\b[^>]*>/gu)].some(
    ([tag]) =>
      tag.includes(`/${variant.main}`) && tag.includes(variant.contentType),
  );
  const hasRootRelation = [
    ...relationships.matchAll(/<Relationship\b[^>]*>/gu),
  ].some(
    ([tag]) => tag.includes("/officeDocument") && tag.includes(variant.main),
  );
  if (!hasOverride || !hasRootRelation) throw unsupported();
  return variant.mime;
}

/** Streams of the compound file by lower-cased name, after entry, size and macro/encryption limits. */
function readOleStreams(path: string, size: number): Map<string, Buffer> {
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
  const encryptedOrMacro = streams.some((entry) =>
    /(?:encryptedpackage|encryptioninfo|vba|macros)/iu.test(entry.name),
  );
  if (encryptedOrMacro) throw new Error("OLE_ENCRYPTED_OR_MACRO");
  return new Map(
    streams.map((entry) => [
      entry.name.toLowerCase(),
      Buffer.from(entry.content),
    ]),
  );
}

function assertWord(word: Buffer): void {
  if (
    word.length < 32 ||
    word.readUInt16LE(0) !== 0xa5ec ||
    (word.readUInt16LE(10) & 0x0100) !== 0
  )
    throw new Error("WORD_INVALID_OR_ENCRYPTED");
}

/** BIFF8 workbook: valid BOF, no FILEPASS (encryption) record, and an EOF record. */
function assertWorkbook(workbook: Buffer): void {
  if (
    workbook.length < 12 ||
    workbook.readUInt16LE(0) !== 0x0809 ||
    workbook.readUInt16LE(2) < 4 ||
    workbook.readUInt16LE(4) !== 0x0600 ||
    workbook.readUInt16LE(6) !== 0x0005
  )
    throw new Error("XLS_INVALID");
  let cursor = 0;
  while (cursor + 4 <= workbook.length) {
    const type = workbook.readUInt16LE(cursor);
    cursor += 4 + workbook.readUInt16LE(cursor + 2);
    if (cursor > workbook.length || type === 0x002f)
      throw new Error("XLS_ENCRYPTED_OR_BROKEN");
    if (type === 0x000a) return;
  }
  throw new Error("XLS_NO_EOF");
}

function assertPowerPoint(current: Buffer, presentation: Buffer): void {
  if (
    current.length < 20 ||
    current.readUInt32LE(12) !== 0xe391c05f ||
    presentation.length < 8 ||
    presentation.readUInt32LE(4) > presentation.length - 8
  )
    throw new Error("PPT_INVALID_OR_ENCRYPTED");
}

function inspectOle(path: string, size: number): string {
  try {
    const streams = readOleStreams(path, size);
    const word = streams.get("worddocument");
    const workbook = streams.get("workbook") ?? streams.get("book");
    const current = streams.get("current user");
    const presentation = streams.get("powerpoint document");
    const isDoc =
      word !== undefined && (streams.has("0table") || streams.has("1table"));
    const isXls = workbook !== undefined;
    const isPpt = current !== undefined && presentation !== undefined;
    if ([isDoc, isXls, isPpt].filter(Boolean).length !== 1)
      throw new Error("OLE_AMBIGUOUS");
    if (isDoc) {
      assertWord(word);
      return "application/msword";
    }
    if (isXls) {
      assertWorkbook(workbook);
      return "application/vnd.ms-excel";
    }
    if (isPpt) {
      assertPowerPoint(current, presentation);
      return "application/vnd.ms-powerpoint";
    }
    throw new Error("OLE_AMBIGUOUS");
  } catch {
    throw unsupported();
  }
}

const isPdf = (head: Buffer, tail: Buffer) =>
  ascii(head, 0, 5) === "%PDF-" && tail.includes(Buffer.from("%%EOF"));

const isPng = (head: Buffer) =>
  head.subarray(0, 8).equals(PNG_SIGNATURE) && ascii(head, 12, 16) === "IHDR";

const isJpeg = (head: Buffer, tail: Buffer) =>
  head[0] === 0xff &&
  head[1] === 0xd8 &&
  head[2] === 0xff &&
  tail[tail.length - 2] === 0xff &&
  tail[tail.length - 1] === 0xd9;

const isWebp = (head: Buffer, size: number) =>
  ascii(head, 0, 4) === "RIFF" &&
  ascii(head, 8, 12) === "WEBP" &&
  head.readUInt32LE(4) + 8 === size;

/** Scans the whole file, keeping a 16-byte overlap so a marker split across chunks is still seen. */
async function assertPdfNotEncrypted(path: string): Promise<void> {
  let previous = Buffer.alloc(0);
  for await (const chunk of createReadStream(path, {
    highWaterMark: READ_CHUNK,
  })) {
    const content = Buffer.concat([previous, chunk as Buffer]);
    if (/\/Encrypt\b/u.test(content.toString("latin1"))) throw unsupported();
    previous = content.subarray(Math.max(0, content.length - 16));
  }
}

/** Plain text only: no markup that a browser would render, no NUL bytes, valid UTF-8 throughout. */
async function assertPlainText(path: string, head: Buffer): Promise<void> {
  if (
    /^\s*<\s*(?:!doctype\s+html|html|svg|script)\b/iu.test(
      head.toString("utf8"),
    )
  )
    throw unsupported();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  // Called without bytes it flushes, which rejects a sequence cut off at end of file.
  const decode = (bytes?: Buffer): void => {
    try {
      decoder.decode(bytes, { stream: bytes !== undefined });
    } catch {
      throw unsupported();
    }
  };
  for await (const chunk of createReadStream(path, {
    highWaterMark: READ_CHUNK,
  })) {
    const bytes = chunk as Buffer;
    if (bytes.includes(0)) throw unsupported();
    decode(bytes);
  }
  decode();
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
  if (isPdf(head, tail)) {
    await assertPdfNotEncrypted(path);
    return "application/pdf";
  }
  if (isPng(head)) return "image/png";
  if (isJpeg(head, tail)) return "image/jpeg";
  if (isWebp(head, size)) return "image/webp";
  if (head.subarray(0, 4).equals(ZIP_SIGNATURE)) return inspectZip(path, size);
  // OLE Office needs stream-level parsing. Never accept a generic CFB signature.
  if (head.subarray(0, 8).equals(OLE_SIGNATURE)) return inspectOle(path, size);
  if (extension === "txt") {
    await assertPlainText(path, head);
    return "text/plain";
  }
  throw unsupported();
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
