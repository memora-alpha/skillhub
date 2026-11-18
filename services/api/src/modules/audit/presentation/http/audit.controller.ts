import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import { paginated } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { AuditReader } from "../../application/services/audit-reader";
import { AuditQueryDto } from "./audit.dto";
import { AuditLogResponse } from "./audit.responses";

@ApiTags("audit")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@Controller({ path: "admin/audit-logs", version: "1" })
export class AuditController {
  constructor(private readonly reader: AuditReader) {}

  @Get()
  @ApiSuccessResponse(200, AuditLogResponse, { paginated: true })
  @ApiOperation({
    summary: "Read administrative audit metadata with audit:read permission",
    description:
      "ADMIN only. Exact actor/action/target filters, [from,to) timestamps. Ordered createdAt DESC,id DESC; restart pagination after changing filters. Snapshots, IP and user agent are excluded.",
  })
  async list(
    @CurrentIdentity() principal: Principal,
    @Query() query: AuditQueryDto,
  ) {
    const result = await this.reader.list(principal, query);
    return paginated(result.data, result.pagination);
  }
}
