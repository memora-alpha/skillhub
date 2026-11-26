import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { DatabaseModule } from "../database/database.module";
import { OutboxModule } from "../events/outbox.module";
import { QueueModule } from "../queue/queue.module";
import { SystemConfigurationModule } from "../../modules/system-configuration/system-configuration.module";
import { SystemConfigurationService } from "../../modules/system-configuration/application/services/system-configuration.service";
import { ClamAvScanner } from "./clamav-scanner.adapter";
import { FileScanProcessor } from "./file-scan.processor";
import {
  FileScanPublisher,
  FILE_SCAN_QUEUE,
  FileScanWorker,
} from "./file-scan.queue";
import { FileStorageService } from "./file-storage.service";
import { FileAttachmentService } from "./file-attachment.service";
import { FileReconciler } from "./file-reconciler";
import { OBJECT_STORAGE, type ObjectStorage } from "./object-storage.port";
import { PrismaStoredFileRepository } from "./prisma-stored-file.repository";
import { STORED_FILE_REPOSITORY } from "./stored-file.repository";
import { UnavailableObjectStorage } from "./unavailable-object-storage.adapter";
import { S3Client } from "@aws-sdk/client-s3";
import { S3ObjectStorage } from "./s3-object-storage.adapter";
import { MATERIAL_MAX_BYTES } from "./file-policy";
import { ContentModerationModule } from "../../modules/content-moderation/content-moderation.module";
import { FileContentModeration } from "./file-content-moderation";

@Module({
  imports: [
    DatabaseModule,
    OutboxModule,
    QueueModule,
    SystemConfigurationModule,
    ContentModerationModule,
    BullModule.registerQueue({ name: FILE_SCAN_QUEUE }),
  ],
  providers: [
    FileAttachmentService,
    FileContentModeration,
    PrismaStoredFileRepository,
    {
      provide: STORED_FILE_REPOSITORY,
      useExisting: PrismaStoredFileRepository,
    },
    {
      provide: OBJECT_STORAGE,
      useFactory: (config: ConfigService) => {
        if (!config.get<boolean>("STORAGE_ENABLED"))
          return new UnavailableObjectStorage();
        const client = new S3Client({
          region: config.getOrThrow<string>("STORAGE_REGION"),
          endpoint: config.getOrThrow<string>("STORAGE_ENDPOINT"),
          forcePathStyle: true,
          credentials: {
            accessKeyId: config.getOrThrow<string>("STORAGE_ACCESS_KEY_ID"),
            secretAccessKey: config.getOrThrow<string>(
              "STORAGE_SECRET_ACCESS_KEY",
            ),
          },
        });
        return new S3ObjectStorage(
          client,
          config.getOrThrow<string>("S3_BUCKET"),
        );
      },
      inject: [ConfigService],
    },
    {
      provide: ClamAvScanner,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new ClamAvScanner({
          host: config.get<string>("CLAMAV_HOST") ?? "127.0.0.1",
          port: config.get<number>("CLAMAV_PORT") ?? 3310,
          timeoutMs: 30_000,
          // The scanner must accept the largest payload admitted by this shared
          // pipeline. Purpose-specific upload validation still enforces lower caps.
          maxBytes: MATERIAL_MAX_BYTES,
        }),
    },
    {
      provide: FileScanProcessor,
      inject: [PrismaStoredFileRepository, OBJECT_STORAGE, ClamAvScanner],
      useFactory: (
        repository: PrismaStoredFileRepository,
        objects: ObjectStorage,
        scanner: ClamAvScanner,
      ) => new FileScanProcessor(repository, objects, scanner),
    },
    {
      provide: FileStorageService,
      inject: [
        PrismaStoredFileRepository,
        OBJECT_STORAGE,
        SystemConfigurationService,
      ],
      useFactory: (
        repository: PrismaStoredFileRepository,
        objects: ObjectStorage,
        configuration: SystemConfigurationService,
      ) => new FileStorageService(repository, objects, configuration),
    },
    FileScanPublisher,
    FileScanWorker,
    {
      provide: FileReconciler,
      inject: [
        PrismaStoredFileRepository,
        OBJECT_STORAGE,
        ConfigService,
        FileContentModeration,
      ],
      useFactory: (
        repository: PrismaStoredFileRepository,
        objects: ObjectStorage,
        config: ConfigService,
        moderation: FileContentModeration,
      ) => new FileReconciler(repository, objects, config, moderation),
    },
  ],
  exports: [
    FileStorageService,
    FileAttachmentService,
    FileContentModeration,
    OBJECT_STORAGE,
  ],
})
export class StorageModule {}
