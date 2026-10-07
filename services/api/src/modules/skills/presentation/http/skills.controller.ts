import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiHeader } from "@nestjs/swagger";
import {
  IdentityGuard,
  CurrentIdentity,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { getOrCreateRequestContext } from "../../../../shared/http/request-context";
import { success, paginated } from "../../../../shared/http/response";
import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";
import { SkillsService } from "../../application/skills.service";
import {
  SkillQueryDto,
  AdminSkillQueryDto,
  CreateSkillDto,
  ChangeSkillDto,
  ArchiveSkillDto,
} from "./skills.dto";
import { SkillResponse } from "./skills.responses";
import type { SkillCommand } from "../../application/skill-contracts";
export function skillCommand(
  request: IdentityRequest,
  key: string | undefined,
  principal: Principal,
): SkillCommand {
  if (!key) throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
  return { principal, key, context: getOrCreateRequestContext(request) };
}
@ApiTags("skills")
@ApiErrorResponse(400)
@ApiErrorResponse(404)
@Controller({ path: "skills", version: "1" })
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}
  @Get()
  @ApiSuccessResponse(200, SkillResponse, { paginated: true })
  async list(@Query() query: SkillQueryDto) {
    const result = await this.skills.list(query);
    return paginated(result.data, result.pagination);
  }
  @Get(":skillId")
  @ApiSuccessResponse(200, SkillResponse)
  async get(@Param("skillId", ParseUUIDPipe) id: string) {
    return success(await this.skills.detail(id));
  }
}
@ApiTags("skill-catalog")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(409)
@ApiHeader({
  name: "Idempotency-Key",
  required: false,
  description: "Required for mutations",
})
@Controller({ path: "admin/skills", version: "1" })
export class CatalogController {
  constructor(private readonly skills: SkillsService) {}
  @Get()
  @ApiSuccessResponse(200, SkillResponse, { paginated: true })
  async list(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Query() query: AdminSkillQueryDto,
  ) {
    const result = await this.skills.adminList(
      { principal, key: "read", context: getOrCreateRequestContext(req) },
      query,
    );
    return paginated(result.data, result.pagination);
  }
  @Post()
  @ApiSuccessResponse(201, SkillResponse)
  async create(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Body() input: CreateSkillDto,
  ) {
    return success(
      await this.skills.create(skillCommand(req, key, principal), input),
    );
  }
  @Patch(":skillId")
  @ApiSuccessResponse(200, SkillResponse)
  async update(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("skillId", ParseUUIDPipe) id: string,
    @Body() input: ChangeSkillDto,
  ) {
    if (
      Object.keys(input).length === 1 ||
      input.name === null ||
      input.slug === null ||
      input.status === null
    )
      throw new BadRequestException("EMPTY_SKILL_PATCH");
    return success(
      await this.skills.change(skillCommand(req, key, principal), id, input),
    );
  }
  @Post(":skillId/archive")
  @HttpCode(200)
  @ApiSuccessResponse(200, SkillResponse)
  async archive(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("skillId", ParseUUIDPipe) id: string,
    @Body() input: ArchiveSkillDto,
  ) {
    return success(
      await this.skills.change(
        skillCommand(req, key, principal),
        id,
        input,
        true,
      ),
    );
  }
}
