import { DOMParser, type Document } from "@xmldom/xmldom";
import { readWordArchive } from "../../../infrastructure/storage/file-format-detector";

const strictOoxmlNamespace = "http://purl.oclc.org/ooxml"; // NOSONAR: S5332, this is a standardized XML identifier and is never fetched.
const wordNamespaces = new Set([
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  `${strictOoxmlNamespace}/wordprocessingml/main`,
]);
const textNamespaces = [
  ...wordNamespaces,
  "http://schemas.openxmlformats.org/drawingml/2006/main",
  `${strictOoxmlNamespace}/drawingml/main`,
];

function assertSupportedRelationships(doc: Document): void {
  for (const relationship of Array.from(
    doc.getElementsByTagNameNS("*", "Relationship"),
  )) {
    const type = relationship.getAttribute("Type") ?? "";
    const isExternal =
      relationship.getAttribute("TargetMode")?.toLowerCase() === "external";
    if (
      /\/(aFChunk|oleObject|package|chart|diagramData|video|audio)$/iu.test(
        type,
      ) ||
      (isExternal && !type.endsWith("/hyperlink"))
    )
      throw new Error("Unsupported DOCX relationship");
  }
}

function readParagraphs(doc: Document): string[] {
  return textNamespaces.flatMap((namespace) => {
    if (
      doc.getElementsByTagNameNS(namespace, "altChunk").length ||
      doc.getElementsByTagNameNS(namespace, "object").length
    )
      throw new Error("Unsupported DOCX embedded content");
    return Array.from(doc.getElementsByTagNameNS(namespace, "p"), (paragraph) =>
      Array.from(
        paragraph.getElementsByTagNameNS(namespace, "t"),
        (run) => run.textContent ?? "",
      ).join(""),
    );
  });
}

export async function extractDocx(bytes: Buffer): Promise<{
  text: string;
  images: Buffer[];
}> {
  const parts = await readWordArchive(bytes);
  const paragraphs: string[] = [];
  const images: Buffer[] = [];
  const parser = new DOMParser({
    onError: (_level, message) => {
      throw new Error(message);
    },
  });
  for (const [name, part] of parts) {
    if (name.startsWith("word/media/")) {
      if (!/\.(png|jpe?g|webp)$/iu.test(name) || images.length >= 20)
        throw new Error("Unsupported DOCX image");
      images.push(part);
      continue;
    }
    if (!/\.(xml|rels)$/u.test(name)) throw new Error("Unsupported DOCX part");
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(part);
    if (/<!DOCTYPE|<!ENTITY/iu.test(xml))
      throw new Error("Unsupported DOCX XML");
    const doc = parser.parseFromString(xml, "application/xml");
    if (
      name === "word/document.xml" &&
      (doc.documentElement?.localName !== "document" ||
        !wordNamespaces.has(doc.documentElement.namespaceURI ?? ""))
    )
      throw new Error("Invalid DOCX main part");
    assertSupportedRelationships(doc);
    paragraphs.push(...readParagraphs(doc));
  }
  return { text: paragraphs.join("\n"), images };
}
