import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import sharp from "sharp";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from "../../../../infrastructure/storage/object-storage.port";

@Injectable()
export class MaterialThumbnailProcessor {
  constructor(
    private readonly db: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly objects: ObjectStorage,
  ) {}

  async process(thumbnailId: string, generation: number): Promise<string> {
    const thumbnail = await this.db.materialThumbnail.findUnique({
      where: { id: thumbnailId },
      include: { sourceFile: true },
    });
    if (!thumbnail || thumbnail.sourceGeneration !== generation)
      return "MISSING";
    const material = await this.db.material.findUnique({
      where: { id: thumbnail.materialId },
      select: { coverFileId: true, coverGeneration: true },
    });
    if (
      !material ||
      material.coverFileId !== thumbnail.sourceFileId ||
      material.coverGeneration !== generation
    ) {
      await this.db.materialThumbnail.updateMany({
        where: { id: thumbnailId, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "SUPERSEDED" },
      });
      return "SUPERSEDED";
    }
    if (thumbnail.status === "READY") return "READY";
    await this.db.materialThumbnail.update({
      where: { id: thumbnailId },
      data: {
        status: "PENDING",
        attempts: { increment: 1 },
        failureCode: null,
      },
    });
    const smallKey = `private/material-thumbnails/${thumbnail.materialId}/${generation}/320x180.webp`;
    const largeKey = `private/material-thumbnails/${thumbnail.materialId}/${generation}/640x360.webp`;
    try {
      const source = await streamBuffer(
        await this.objects.read(thumbnail.sourceFile.objectKey),
        10_000_000,
      );
      const image = sharp(source, {
        animated: false,
        failOn: "error",
        limitInputPixels: 40_000_000,
      }).rotate();
      const metadata = await image.metadata();
      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width < 640 ||
        metadata.height < 360 ||
        (metadata.pages ?? 1) !== 1
      )
        throw new Error("MATERIAL_COVER_INVALID");
      const [small, large] = await Promise.all([
        image
          .clone()
          .resize(320, 180, { fit: "cover", position: "centre" })
          .webp({ quality: 82 })
          .toBuffer(),
        image
          .clone()
          .resize(640, 360, { fit: "cover", position: "centre" })
          .webp({ quality: 82 })
          .toBuffer(),
      ]);
      await Promise.all([
        this.objects.put(smallKey, Readable.from(small), "image/webp"),
        this.objects.put(largeKey, Readable.from(large), "image/webp"),
      ]);
      const updated = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT material_id FROM materials WHERE material_id = ${thumbnail.materialId}::uuid FOR UPDATE`;
        const current = await tx.material.findUnique({
          where: { id: thumbnail.materialId },
          select: { coverFileId: true, coverGeneration: true },
        });
        if (
          current?.coverFileId !== thumbnail.sourceFileId ||
          current.coverGeneration !== generation
        ) {
          await tx.materialThumbnail.update({
            where: { id: thumbnailId },
            data: { status: "SUPERSEDED" },
          });
          return false;
        }
        await tx.materialThumbnail.update({
          where: { id: thumbnailId },
          data: {
            status: "READY",
            smallObjectKey: smallKey,
            largeObjectKey: largeKey,
            smallSizeBytes: small.length,
            largeSizeBytes: large.length,
            smallChecksum: checksum(small),
            largeChecksum: checksum(large),
            failureCode: null,
          },
        });
        return true;
      });
      if (!updated) {
        await Promise.allSettled([
          this.objects.remove(smallKey),
          this.objects.remove(largeKey),
        ]);
        return "SUPERSEDED";
      }
      return "READY";
    } catch (error) {
      await this.db.materialThumbnail.updateMany({
        where: { id: thumbnailId, status: "PENDING" },
        data: { status: "FAILED", failureCode: safeFailureCode(error) },
      });
      throw error;
    }
  }
}

async function streamBuffer(stream: Readable, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > limit) throw new Error("MATERIAL_COVER_TOO_LARGE");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

const checksum = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");

function safeFailureCode(error: unknown) {
  if (error instanceof Error && /^[A-Z0-9_]{1,100}$/u.test(error.message))
    return error.message;
  return "MATERIAL_THUMBNAIL_GENERATION_FAILED";
}
