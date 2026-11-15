import { Inject, Injectable } from "@nestjs/common";
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from "../../../../infrastructure/storage/object-storage.port";

type ReadyThumbnail = {
  smallObjectKey: string | null;
  largeObjectKey: string | null;
  status: string;
};

@Injectable()
export class MaterialThumbnailsService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly objects: ObjectStorage,
  ) {}

  async publicProjection(
    mimeType: string | null,
    thumbnail?: ReadyThumbnail | null,
  ) {
    if (
      thumbnail?.status !== "READY" ||
      !thumbnail.smallObjectKey ||
      !thumbnail.largeObjectKey
    )
      return placeholder(mimeType);
    try {
      const [smallUrl, largeUrl] = await Promise.all([
        this.objects.signGet(thumbnail.smallObjectKey, {
          expiresInSeconds: 300,
          disposition: "inline",
          mime: "image/webp",
        }),
        this.objects.signGet(thumbnail.largeObjectKey, {
          expiresInSeconds: 300,
          disposition: "inline",
          mime: "image/webp",
        }),
      ]);
      return {
        kind: "GENERATED" as const,
        smallUrl,
        largeUrl,
        expiresAt: new Date(Date.now() + 300_000),
      };
    } catch {
      return placeholder(mimeType);
    }
  }
}

function placeholder(mimeType: string | null) {
  const format =
    mimeType === "application/pdf"
      ? "PDF"
      : mimeType?.includes("wordprocessingml")
        ? "DOCX"
        : mimeType?.includes("presentationml")
          ? "PPTX"
          : mimeType?.includes("spreadsheetml")
            ? "XLSX"
            : "FILE";
  return { kind: "PLACEHOLDER" as const, format };
}
