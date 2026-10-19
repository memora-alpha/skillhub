import type { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileStorageError } from "./file.types";
import type { ObjectStorage } from "./object-storage.port";

function unavailable(): FileStorageError {
  return new FileStorageError("FILE_STORAGE_UNAVAILABLE", 503);
}

export class S3ObjectStorage implements ObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {
    if (!bucket) throw new Error("S3 bucket is required");
  }

  async put(key: string, body: Readable, mime: string): Promise<void> {
    try {
      await new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: mime,
        },
        queueSize: 1,
        partSize: 5 * 1024 * 1024,
        leavePartsOnError: false,
      }).done();
    } catch {
      throw unavailable();
    }
  }

  async read(key: string): Promise<Readable> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (
        !response.Body ||
        typeof (response.Body as Readable)[Symbol.asyncIterator] !== "function"
      ) {
        throw unavailable();
      }
      return response.Body as Readable;
    } catch {
      throw unavailable();
    }
  }

  async head(
    key: string,
  ): Promise<{ size: number; versionId?: string } | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (
        !Number.isSafeInteger(response.ContentLength) ||
        (response.ContentLength ?? -1) < 0
      )
        throw unavailable();
      return { size: response.ContentLength!, versionId: response.VersionId };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        (error.name === "NotFound" || error.name === "NoSuchKey")
      )
        return null;
      throw unavailable();
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      throw unavailable();
    }
  }

  async signGet(
    key: string,
    input: { expiresInSeconds: number; disposition: string; mime: string },
  ): Promise<string> {
    if (
      !Number.isInteger(input.expiresInSeconds) ||
      input.expiresInSeconds < 1 ||
      input.expiresInSeconds > 300
    ) {
      throw new FileStorageError("FILE_POLICY_UNAVAILABLE", 503);
    }
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ResponseContentDisposition: input.disposition,
          ResponseContentType: input.mime,
        }),
        { expiresIn: input.expiresInSeconds },
      );
    } catch {
      throw unavailable();
    }
  }
}
