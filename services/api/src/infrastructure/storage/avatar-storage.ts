import { AvatarStoragePort } from "../../modules/users/application/ports/avatar-providers";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class AvatarStorage extends AvatarStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;
  constructor(config: ConfigService) {
    super();
    this.bucket = config.getOrThrow<string>("S3_AVATAR_BUCKET");
    const endpoint = config.getOrThrow<string>("S3_ENDPOINT");
    if (
      !this.bucket ||
      !/^https?:\/\//.test(endpoint) ||
      (config.get("NODE_ENV") === "production" &&
        !endpoint.startsWith("https://"))
    )
      throw new Error("Invalid S3 configuration");
    this.client = new S3Client({
      endpoint,
      region: config.getOrThrow<string>("S3_REGION"),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>("S3_ACCESS_KEY"),
        secretAccessKey: config.getOrThrow<string>("S3_SECRET_KEY"),
      },
      maxAttempts: 2,
    });
  }
  async put(key: string, data: Buffer, mime: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: mime,
        CacheControl: "private, no-store",
      }),
    );
  }
  async read(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body || Number(result.ContentLength) > 5 * 1024 * 1024)
      throw new Error("Invalid stored avatar");
    return Buffer.from(await result.Body.transformToByteArray());
  }
  async remove(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
  url(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 60 },
    );
  }
}
