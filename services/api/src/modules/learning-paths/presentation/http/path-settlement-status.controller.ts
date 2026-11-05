import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import { PathSettlementStatusService } from "../../application/services/path-settlement-status.service";

@ApiTags("learning-paths")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "learning-paths", version: "1" })
export class PathSettlementStatusController {
  constructor(private readonly status: PathSettlementStatusService) {}
  @Get(":pathId/settlement-status")
  @ApiOperation({
    summary:
      "Read live settlement blockers and safe diagnostics; never computes Credit on the client",
  })
  async read(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) pathId: string,
  ) {
    return success(await this.status.read(actor, pathId));
  }
}
