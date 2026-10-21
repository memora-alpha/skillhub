import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { MaterialCatalogService } from "../../application/services/material-catalog.service";
import { MaterialPurchaseService } from "../../application/services/material-purchase.service";
import { MaterialReportsService } from "../../application/services/material-reports.service";
import { PurchaseMaterialDto, ReportMaterialDto } from "./materials.dto";

@ApiTags("materials")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ version: "1" })
export class MaterialAccessController {
  constructor(
    private readonly catalog: MaterialCatalogService,
    private readonly purchases: MaterialPurchaseService,
    private readonly reports: MaterialReportsService,
  ) {}

  @Get("materials/:materialId/download")
  @Header("Cache-Control", "no-store")
  async download(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
  ) {
    return success(await this.catalog.download(actor, id));
  }

  @Post("materials/:materialId/purchase")
  @Header("Cache-Control", "no-store")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async purchase(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: PurchaseMaterialDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.purchases.purchase(
      actor,
      id,
      body.expectedListingVersion,
      key,
    );
    response.status(result.replayed ? 200 : 201);
    return success(result.order, "Material purchased.");
  }

  @Post("materials/:materialId/reports")
  async report(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
    @Body() body: ReportMaterialDto,
  ) {
    return success(
      await this.reports.report(actor, id, body),
      "Material report submitted.",
    );
  }

  @Get("me/material-orders")
  async orders(@CurrentIdentity() actor: Principal) {
    return success(await this.purchases.listOrders(actor));
  }
}
