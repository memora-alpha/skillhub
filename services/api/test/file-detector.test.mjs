import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { FileFormatDetector } from "../dist/infrastructure/storage/file-format-detector.js";
import { extractDocx } from "../dist/modules/content-moderation/infrastructure/docx-content.js";
import CFB from "cfb";
import { randomBytes } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import sharp from "sharp";

const detector = new FileFormatDetector();
const pdf = Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");

test("accepts bounded zero padding on valid JPG without accepting other trailers", async () => {
  const jpeg = await sharp({
    create: { width: 96, height: 64, channels: 3, background: "#2862a3" },
  })
    .jpeg()
    .toBuffer();
  const inspect = (bytes) =>
    detector.inspect({
      name: "sample.JPG",
      purpose: "CHAT",
      body: Readable.from([bytes]),
    });
  const padded = Buffer.concat([jpeg, Buffer.alloc(4)]);
  const result = await inspect(padded);
  assert.equal(result.detectedMime, "image/jpeg");
  assert.equal(result.sizeBytes, padded.length);
  for (const invalid of [
    Buffer.concat([jpeg, Buffer.alloc(17)]),
    Buffer.concat([jpeg, Buffer.from("unexpected")]),
    Buffer.concat([jpeg.subarray(0, 8), Buffer.from([0xff, 0xd9, 0x00])]),
  ]) {
    await assert.rejects(inspect(invalid), { code: "FILE_FORMAT_UNSUPPORTED" });
  }
});

function makeZip(entries, flags = 0) {
  const parts = [];
  const directory = [];
  let position = 0;
  for (const [name, content, compression = "store"] of entries) {
    const nameBytes = Buffer.from(name);
    const expanded = Buffer.from(content);
    const method = compression === "deflate" ? 8 : 0;
    const bytes = method === 8 ? deflateRawSync(expanded) : expanded;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(expanded.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, nameBytes, bytes);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(expanded.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(position, 42);
    directory.push(central, nameBytes);
    position += local.length + nameBytes.length + bytes.length;
  }
  const centralLength = directory.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralLength, 12);
  end.writeUInt32LE(position, 16);
  return Buffer.concat([...parts, ...directory, end]);
}

function declareFirstEntryExpandedSize(zip, expandedSize) {
  const patched = Buffer.from(zip);
  const endOffset = patched.length - 22;
  const centralOffset = patched.readUInt32LE(endOffset + 16);
  patched.writeUInt32LE(expandedSize, centralOffset + 24);
  return patched;
}

const docxEntries = [
  [
    "[Content_Types].xml",
    '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  ],
  [
    "_rels/.rels",
    '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  ],
  ["word/document.xml", "<document/>"],
];

test("extracts real DOCX archive text runs, header text, and image bytes", async () => {
  const namespace =
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const fixture = makeZip([
    ...docxEntries.slice(0, 2),
    [
      "word/document.xml",
      `<w:document xmlns:w="${namespace}"><w:body><w:p><w:r><w:t>Bài </w:t></w:r><w:r><w:t>tập</w:t></w:r></w:p></w:body></w:document>`,
    ],
    [
      "word/header1.xml",
      `<w:hdr xmlns:w="${namespace}"><w:p><w:r><w:t>Tiêu đề</w:t></w:r></w:p></w:hdr>`,
    ],
    ["word/media/image1.png", Buffer.from("test image")],
  ]);
  const result = await extractDocx(fixture);
  assert.equal(result.text, "Bài tập\nTiêu đề");
  assert.deepEqual(result.images, [Buffer.from("test image")]);
  await assert.rejects(
    extractDocx(
      makeZip([
        ...docxEntries.slice(0, 2),
        ["word/document.xml", "<!DOCTYPE document><document/>"],
      ]),
    ),
  );
});

test("extracts text under both Strict OOXML namespaces", async () => {
  const fixture = makeZip([
    ...docxEntries.slice(0, 2),
    [
      "word/document.xml",
      '<w:document xmlns:w="http://purl.oclc.org/ooxml/wordprocessingml/main" xmlns:a="http://purl.oclc.org/ooxml/drawingml/main"><w:body><w:p><w:r><w:t>Strict Word</w:t></w:r></w:p><a:p><a:r><a:t>Strict drawing</a:t></a:r></a:p></w:body></w:document>',
    ],
  ]);
  const result = await extractDocx(fixture);
  assert.equal(result.text, "Strict Word\nStrict drawing");
});

test("detects a valid PDF and hashes the exact stream", async () => {
  const result = await detector.inspect({
    body: Readable.from([pdf]),
    name: "test.pdf",
    purpose: "EVIDENCE",
    capBytes: 10_000_000,
  });
  assert.equal(result.detectedMime, "application/pdf");
  assert.equal(result.sizeBytes, pdf.length);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test("rejects executable under PDF extension and uninspectable ZIP under DOCX", async () => {
  await assert.rejects(
    detector.inspect({
      body: Readable.from([Buffer.from("MZ binary")]),
      name: "test.pdf",
      purpose: "EVIDENCE",
      capBytes: 10_000_000,
    }),
    /FILE_FORMAT_UNSUPPORTED/,
  );
  await assert.rejects(
    detector.inspect({
      body: Readable.from([Buffer.from("PK\u0003\u0004 fake")]),
      name: "test.docx",
      purpose: "EVIDENCE",
      capBytes: 10_000_000,
    }),
    /FILE_FORMAT_UNSUPPORTED/,
  );
});

test("actual streamed bytes enforce the cap", async () => {
  await assert.rejects(
    detector.inspect({
      body: Readable.from([Buffer.alloc(7), Buffer.alloc(4)]),
      name: "test.pdf",
      purpose: "EVIDENCE",
      capBytes: 10,
    }),
    /FILE_TOO_LARGE/,
  );
});

test("plain text is chat-only and malformed UTF-8 is rejected", async () => {
  const input = {
    name: "hello.txt",
    purpose: "CHAT",
    body: Readable.from([Buffer.from("hello\nworld")]),
    capBytes: 15_000_000,
  };
  assert.equal((await detector.inspect(input)).detectedMime, "text/plain");
  await assert.rejects(
    detector.inspect({
      ...input,
      body: Readable.from([Buffer.from([0xff, 0xfe, 0x00])]),
    }),
    /FILE_FORMAT_UNSUPPORTED/,
  );
});

test("valid OOXML container passes; generic ZIP and encrypted OOXML fail", async () => {
  const input = {
    name: "letter.docx",
    purpose: "EVIDENCE",
    capBytes: 10_000_000,
  };
  const good = await detector.inspect({
    ...input,
    body: Readable.from([makeZip(docxEntries)]),
  });
  assert.equal(
    good.detectedMime,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  const fake = makeZip([
    ["[Content_Types].xml", "<Types/>"],
    docxEntries[1],
    docxEntries[2],
  ]);
  await assert.rejects(
    detector.inspect({ ...input, body: Readable.from([fake]) }),
    /FILE_FORMAT_UNSUPPORTED/,
  );
  await assert.rejects(
    detector.inspect({
      ...input,
      body: Readable.from([makeZip(docxEntries, 1)]),
    }),
    /FILE_FORMAT_UNSUPPORTED/,
  );
});

test("valid OOXML above 10x passes while archive safety limits return 413", async () => {
  const input = {
    name: "expanded.docx",
    purpose: "EVIDENCE",
    capBytes: 10_000_000,
  };
  const validExpanded = makeZip([
    docxEntries[0],
    docxEntries[1],
    ["word/document.xml", Buffer.alloc(800_000, 0x61), "deflate"],
    ["word/media/padding.bin", randomBytes(40_000)],
  ]);
  assert.ok(800_000 / validExpanded.length > 10);
  assert.ok(800_000 / validExpanded.length < 50);
  assert.equal(
    (
      await detector.inspect({
        ...input,
        body: Readable.from([validExpanded]),
      })
    ).detectedMime,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );

  const excessiveRatio = makeZip([
    docxEntries[0],
    docxEntries[1],
    ["word/document.xml", Buffer.alloc(3_000_000, 0x61), "deflate"],
  ]);
  await assert.rejects(
    detector.inspect({ ...input, body: Readable.from([excessiveRatio]) }),
    /FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED/,
  );

  const tooManyEntries = makeZip([
    ...docxEntries,
    ...Array.from({ length: 998 }, (_, index) => [
      `word/media/${index}.bin`,
      Buffer.from([index % 255]),
    ]),
  ]);
  await assert.rejects(
    detector.inspect({ ...input, body: Readable.from([tooManyEntries]) }),
    /FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED/,
  );

  const excessiveAbsoluteSize = declareFirstEntryExpandedSize(
    makeZip(docxEntries),
    100_000_001,
  );
  await assert.rejects(
    detector.inspect({
      ...input,
      body: Readable.from([excessiveAbsoluteSize]),
    }),
    /FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED/,
  );

  const oversizedCentralDirectory = makeZip([
    ...docxEntries,
    ...Array.from({ length: 997 }, (_, index) => [
      `word/media/${"a".repeat(510)}-${index}.bin`,
      Buffer.alloc(0),
    ]),
  ]);
  await assert.rejects(
    detector.inspect({
      ...input,
      body: Readable.from([oversizedCentralDirectory]),
    }),
    /FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED/,
  );

  const oversizedCapturedXml = makeZip([
    [
      "[Content_Types].xml",
      Buffer.concat([
        Buffer.from(docxEntries[0][1]),
        Buffer.alloc(256_001, 0x20),
      ]),
    ],
    docxEntries[1],
    docxEntries[2],
  ]);
  await assert.rejects(
    detector.inspect({
      ...input,
      body: Readable.from([oversizedCapturedXml]),
    }),
    /FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED/,
  );
});

test("material covers enforce static image dimensions and pixel safety", async () => {
  const valid = await sharp({
    create: {
      width: 640,
      height: 360,
      channels: 3,
      background: { r: 40, g: 80, b: 120 },
    },
  })
    .png()
    .toBuffer();
  const result = await detector.inspect({
    body: Readable.from([valid]),
    name: "cover.png",
    purpose: "MATERIAL_COVER",
    capBytes: 10_000_000,
  });
  assert.equal(result.detectedMime, "image/png");

  const tooSmall = await sharp({
    create: {
      width: 320,
      height: 180,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .webp()
    .toBuffer();
  await assert.rejects(
    detector.inspect({
      body: Readable.from([tooSmall]),
      name: "cover.webp",
      purpose: "MATERIAL_COVER",
      capBytes: 10_000_000,
    }),
    /MATERIAL_COVER_INVALID/,
  );
});

test("HTML and SVG disguised as text are rejected", async () => {
  for (const body of [
    "<!doctype html><html></html>",
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  ]) {
    await assert.rejects(
      detector.inspect({
        name: "notes.txt",
        purpose: "CHAT",
        capBytes: 15_000_000,
        body: Readable.from([Buffer.from(body)]),
      }),
      /FILE_FORMAT_UNSUPPORTED/,
    );
  }
});

test("late PDF encryption marker is rejected beyond the initial sniff window", async () => {
  const encrypted = Buffer.concat([
    Buffer.from("%PDF-1.7\n"),
    Buffer.alloc(1_100_000, 0x20),
    Buffer.from("/Encrypt 1 0 R\n%%EOF"),
  ]);
  await assert.rejects(
    detector.inspect({
      body: Readable.from([encrypted]),
      name: "secret.pdf",
      purpose: "EVIDENCE",
      capBytes: 10_000_000,
    }),
    /FILE_FORMAT_UNSUPPORTED/,
  );
});

test("legacy Office requires its internal stream and rejects encrypted Word", async () => {
  const word = Buffer.alloc(64);
  word.writeUInt16LE(0xa5ec, 0);
  word.writeUInt16LE(0x00bf, 16);
  const makeDoc = (content) => {
    const container = CFB.utils.cfb_new();
    CFB.utils.cfb_add(container, "WordDocument", content);
    CFB.utils.cfb_add(container, "0Table", Buffer.alloc(8));
    return CFB.write(container, { type: "buffer" });
  };
  const input = { name: "old.doc", purpose: "EVIDENCE", capBytes: 10_000_000 };
  assert.equal(
    (await detector.inspect({ ...input, body: Readable.from([makeDoc(word)]) }))
      .detectedMime,
    "application/msword",
  );
  word.writeUInt16LE(0x0100, 10);
  await assert.rejects(
    detector.inspect({ ...input, body: Readable.from([makeDoc(word)]) }),
    /FILE_FORMAT_UNSUPPORTED/,
  );
  const generic = CFB.utils.cfb_new();
  CFB.utils.cfb_add(generic, "random", Buffer.alloc(16));
  await assert.rejects(
    detector.inspect({
      ...input,
      body: Readable.from([CFB.write(generic, { type: "buffer" })]),
    }),
    /FILE_FORMAT_UNSUPPORTED/,
  );
});

test("legacy Excel and PowerPoint require their own records and reject encryption", async () => {
  const packageCfb = (entries) => {
    const container = CFB.utils.cfb_new();
    for (const [name, bytes] of entries)
      CFB.utils.cfb_add(container, name, bytes);
    return CFB.write(container, { type: "buffer" });
  };
  const workbook = Buffer.from([
    0x09, 0x08, 0x04, 0x00, 0x00, 0x06, 0x05, 0x00, 0x0a, 0x00, 0x00, 0x00,
  ]);
  const xls = { name: "sheet.xls", purpose: "CHAT", capBytes: 15_000_000 };
  assert.equal(
    (
      await detector.inspect({
        ...xls,
        body: Readable.from([packageCfb([["Workbook", workbook]])]),
      })
    ).detectedMime,
    "application/vnd.ms-excel",
  );
  const encryptedWorkbook = Buffer.concat([
    workbook.subarray(0, 8),
    Buffer.from([0x2f, 0x00, 0x00, 0x00]),
    workbook.subarray(8),
  ]);
  await assert.rejects(
    detector.inspect({
      ...xls,
      body: Readable.from([packageCfb([["Workbook", encryptedWorkbook]])]),
    }),
    /FILE_FORMAT_UNSUPPORTED/,
  );

  const currentUser = Buffer.alloc(20);
  currentUser.writeUInt32LE(0xe391c05f, 12);
  const presentation = Buffer.alloc(8);
  const ppt = { name: "slides.ppt", purpose: "CHAT", capBytes: 15_000_000 };
  assert.equal(
    (
      await detector.inspect({
        ...ppt,
        body: Readable.from([
          packageCfb([
            ["Current User", currentUser],
            ["PowerPoint Document", presentation],
          ]),
        ]),
      })
    ).detectedMime,
    "application/vnd.ms-powerpoint",
  );
  currentUser.writeUInt32LE(0xf3d1c4df, 12);
  await assert.rejects(
    detector.inspect({
      ...ppt,
      body: Readable.from([
        packageCfb([
          ["Current User", currentUser],
          ["PowerPoint Document", presentation],
        ]),
      ]),
    }),
    /FILE_FORMAT_UNSUPPORTED/,
  );
});
