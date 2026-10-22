import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { paginated, success } from "../../../../shared/http/response";
import { MaterialCatalogService } from "../../application/services/material-catalog.service";
import { MaterialQueryDto } from "./materials.dto";

/** Share links open metadata/preview only (FR-MAT-03); no identity required. */
@ApiTags("materials")
@Controller({ path: "materials", version: "1" })
export class PublicMaterialsController {
  constructor(private readonly catalog: MaterialCatalogService) {}

  @Get()
  async search(@Query() query: MaterialQueryDto) {
    const result = await this.catalog.search(query);
    return paginated(result.data, result.pagination);
  }

  @Get(":materialId")
  async detail(@Param("materialId", ParseUUIDPipe) id: string) {
    return success(await this.catalog.detail(id));
  }
}
