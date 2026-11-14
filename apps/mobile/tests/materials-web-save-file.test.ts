import assert from "node:assert/strict";
import { test } from "node:test";
import { materialWebDownloadName } from "../src/features/materials/utils/material-web-download-name";
import { materialMimeTypes } from "../src/features/materials/utils/material-upload";
import { prepareMaterialDownload } from "../src/features/materials/utils/save-material-file.web";

test("web download keeps Office/PDF extensions without a readable storage filename", () => {
  for (const [extension, mime] of Object.entries(materialMimeTypes)) {
    assert.equal(materialWebDownloadName(null, mime), `tai-lieu.${extension}`);
    assert.equal(
      materialWebDownloadName(null, `${mime}; charset=UTF-8`),
      `tai-lieu.${extension}`,
    );
  }
  assert.equal(materialWebDownloadName(null, "image/png"), "tai-lieu.png");
  assert.equal(
    materialWebDownloadName(null, "application/octet-stream"),
    "tai-lieu",
  );
  assert.equal(
    materialWebDownloadName(
      'attachment; filename="purchased-v1.docx"',
      "application/pdf",
    ),
    "purchased-v1.docx",
  );
  assert.equal(
    materialWebDownloadName("attachment; filename=lesson.xlsx", ""),
    "lesson.xlsx",
  );
  assert.equal(
    materialWebDownloadName(
      "attachment; filename=backup.docx; filename*=UTF-8''B%C3%A0i%20h%E1%BB%8Dc.docx",
      "",
    ),
    "Bài học.docx",
  );
  assert.equal(
    materialWebDownloadName(
      "attachment; filename=backup.docx; filename*=UTF-8''%ZZ",
      "",
    ),
    "backup.docx",
  );
  assert.equal(
    materialWebDownloadName(
      "attachment; filename*=UTF-8''..%2Fprivate%0A.docx",
      "",
    ),
    ".._private.docx",
  );
});

test("web saver uses response MIME, omits credentials and never saves an aborted transfer", async (context) => {
  const filenames: string[] = [];
  const requests: RequestInit[] = [];
  let removed = 0;
  context.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options: RequestInit) => {
      requests.push(options);
      return new Response("bytes", {
        headers: { "Content-Type": materialMimeTypes.docx! },
      });
    },
  );
  context.mock.method(globalThis, "setTimeout", (callback: () => void) => {
    callback();
    return 1;
  });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: { appendChild() {} },
      createElement: () => ({
        href: "",
        download: "",
        click() {
          filenames.push(this.download);
        },
        remove() {
          removed++;
        },
      }),
    },
  });
  try {
    const save = (await prepareMaterialDownload())!;
    await save("https://storage.test/file", new AbortController().signal);
    assert.deepEqual(filenames, ["tai-lieu.docx"]);
    assert.equal(requests[0]?.credentials, "omit");
    assert.equal(removed, 1);
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(save("https://storage.test/file", aborted.signal), {
      name: "AbortError",
    });
    assert.equal(filenames.length, 1);
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
