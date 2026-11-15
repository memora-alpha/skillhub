import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { QueueModule } from "../../infrastructure/queue/queue.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { AuditModule } from "../audit/audit.module";
import { CreditModule } from "../credit/credit.module";
import { IdentityModule } from "../identity.module";
import { MaterialCatalogService } from "./application/services/material-catalog.service";
import { MaterialModerationService } from "./application/services/material-moderation.service";
import { MaterialPurchaseService } from "./application/services/material-purchase.service";
import { MaterialReportsService } from "./application/services/material-reports.service";
import { MaterialReviewsService } from "./application/services/material-reviews.service";
import { MaterialReviewModerationService } from "./application/services/material-review-moderation.service";
import { MaterialThumbnailsService } from "./application/services/material-thumbnails.service";
import { MaterialThumbnailProcessor } from "./infrastructure/jobs/material-thumbnail.processor";
import {
  MATERIAL_THUMBNAIL_QUEUE,
  MaterialThumbnailPublisher,
  MaterialThumbnailWorker,
} from "./infrastructure/jobs/material-thumbnail.queue";
import { MaterialDownloadGrantRecovery } from "./infrastructure/jobs/material-download-grant-recovery";
import { MaterialsService } from "./application/services/materials.service";
import { MaterialAccessController } from "./presentation/http/material-access.controller";
import { MaterialModerationController } from "./presentation/http/material-moderation.controller";
import { MyMaterialsController } from "./presentation/http/my-materials.controller";
import { PublicMaterialsController } from "./presentation/http/public-materials.controller";
import {
  MaterialReviewsController,
  PublicMaterialReviewsController,
} from "./presentation/http/material-reviews.controller";
import { MaterialReviewModerationController } from "./presentation/http/material-review-moderation.controller";
import { MaterialFavoritesService } from "./application/services/material-favorites.service";

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    IdentityModule,
    AuditModule,
    CreditModule,
    IdempotencyModule,
    QueueModule,
    OutboxModule,
    BullModule.registerQueue({ name: MATERIAL_THUMBNAIL_QUEUE }),
  ],
  controllers: [
    PublicMaterialsController,
    MaterialAccessController,
    MyMaterialsController,
    MaterialModerationController,
    PublicMaterialReviewsController,
    MaterialReviewsController,
    MaterialReviewModerationController,
  ],
  providers: [
    MaterialsService,
    MaterialModerationService,
    MaterialCatalogService,
    MaterialPurchaseService,
    MaterialReportsService,
    MaterialReviewsService,
    MaterialReviewModerationService,
    MaterialThumbnailsService,
    MaterialThumbnailProcessor,
    MaterialThumbnailPublisher,
    MaterialThumbnailWorker,
    MaterialDownloadGrantRecovery,
    MaterialFavoritesService,
  ],
})
export class MaterialsModule {}
