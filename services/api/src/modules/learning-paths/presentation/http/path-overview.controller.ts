import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { paginated, success } from "../../../../shared/http/response";
import {
  PathOverviewReader,
  overviewCard,
} from "../../application/services/path-overview.reader";
@ApiTags("learning-paths")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "learning-paths", version: "1" })
export class PathOverviewController {
  constructor(private readonly overview: PathOverviewReader) {}
  @Get(":pathId/overview")
  @ApiOperation({
    summary:
      "Read viewer-specific learning stage, attention and settlement; no lifecycle writes",
  })
  async read(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) id: string,
  ) {
    const view = await this.overview.read(actor, id);
    return success({
      ...overviewCard(view),
      attentionItems: view.attentionItems,
    });
  }
  @Get(":pathId/cases/:caseId/summary")
  @ApiOperation({
    summary:
      "Read participant-safe summary, including partner and system cases",
  })
  async caseSummary(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) id: string,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    const view = await this.overview.read(actor, id);
    const item = view.cases.find((row) => row.id === caseId);
    if (!item) throw new NotFoundException("REPORT_CASE_NOT_FOUND");
    return success({
      ...item,
      attention:
        view.attentionItems.find((row) => row.key === "case:" + caseId) ?? null,
    });
  }
  @Get(":pathId/cases")
  @ApiOperation({ summary: "Read participant-safe case list" })
  async cases(
    @CurrentIdentity() actor: Principal,
    @Param("pathId", ParseUUIDPipe) id: string,
    @Query("cursor") cursor?: string,
    @Query("limit") rawLimit?: string,
  ) {
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (rawLimit !== undefined && !/^[1-9]\d*$/.test(rawLimit))
    )
      throw new BadRequestException("INVALID_CASE_LIMIT");
    const view = await this.overview.read(actor, id);
    let offset = 0;
    if (cursor) {
      try {
        if (cursor.length > 1024) throw new Error("size");
        const row = JSON.parse(
          Buffer.from(cursor, "base64url").toString("utf8"),
        );
        if (
          row.pathId !== id ||
          row.actorId !== actor.userId ||
          typeof row.id !== "string"
        )
          throw new Error("scope");
        const index = view.cases.findIndex((item) => item.id === row.id);
        if (index < 0) throw new Error("missing");
        offset = index + 1;
      } catch {
        throw new BadRequestException("INVALID_CASE_CURSOR");
      }
    }
    const page = view.cases.slice(offset, offset + limit),
      last = page.at(-1);
    const hasMore = view.cases.length > offset + limit;
    return paginated(page, {
      limit,
      hasMore,
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({
                pathId: id,
                actorId: actor.userId,
                id: last.id,
              }),
            ).toString("base64url")
          : null,
    });
  }
}
