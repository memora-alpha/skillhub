import { DOMParser } from "@xmldom/xmldom";
import { readWordArchive } from "../../../infrastructure/storage/file-format-detector";

const wordNamespaces = [
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  "http://purl.oclc.org/ooxml/wordprocessingml/main",
];
const drawingNamespaces = [
  "http://schemas.openxmlformats.org/drawingml/2006/main",
  "http://purl.oclc.org/ooxml/drawingml/main",
];

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
        !wordNamespaces.includes(doc.documentElement.namespaceURI ?? ""))
    )
      throw new Error("Invalid DOCX main part");
    for (const relationship of Array.from(
      doc.getElementsByTagNameNS("*", "Relationship"),
    )) {
      const type = relationship.getAttribute("Type") ?? "";
      if (
        /\/(aFChunk|oleObject|package|chart|diagramData|video|audio)$/iu.test(
          type,
        ) ||
        (relationship.getAttribute("TargetMode")?.toLowerCase() ===
          "external" &&
          !type.endsWith("/hyperlink"))
      ) {
        throw new Error("Unsupported DOCX relationship");
      }
    }
    for (const namespace of [...wordNamespaces, ...drawingNamespaces]) {
      if (
        doc.getElementsByTagNameNS(namespace, "altChunk").length ||
        doc.getElementsByTagNameNS(namespace, "object").length
      )
        throw new Error("Unsupported DOCX embedded content");
      for (const paragraph of Array.from(
        doc.getElementsByTagNameNS(namespace, "p"),
      )) {
        const runs = Array.from(
          paragraph.getElementsByTagNameNS(namespace, "t"),
        );
        paragraphs.push(runs.map((run) => run.textContent ?? "").join(""));
      }
    }
  }
  return { text: paragraphs.join("\n"), images };
}
