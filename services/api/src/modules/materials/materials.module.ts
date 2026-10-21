import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { AuditModule } from "../audit/audit.module";
import { CreditModule } from "../credit/credit.module";
import { IdentityModule } from "../identity.module";
import { MaterialCatalogService } from "./application/services/material-catalog.service";
import { MaterialModerationService } from "./application/services/material-moderation.service";
import { MaterialPurchaseService } from "./application/services/material-purchase.service";
import { MaterialReportsService } from "./application/services/material-reports.service";
import { MaterialsService } from "./application/services/materials.service";
import { MaterialAccessController } from "./presentation/http/material-access.controller";
import { MaterialModerationController } from "./presentation/http/material-moderation.controller";
import { MyMaterialsController } from "./presentation/http/my-materials.controller";
import { PublicMaterialsController } from "./presentation/http/public-materials.controller";

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    IdentityModule,
    AuditModule,
    CreditModule,
  ],
  controllers: [
    PublicMaterialsController,
    MaterialAccessController,
    MyMaterialsController,
    MaterialModerationController,
  ],
  providers: [
    MaterialsService,
    MaterialModerationService,
    MaterialCatalogService,
    MaterialPurchaseService,
    MaterialReportsService,
  ],
})
export class MaterialsModule {}
