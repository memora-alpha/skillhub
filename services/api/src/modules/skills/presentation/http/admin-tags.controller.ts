import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import {
  IdentityGuard,
  CurrentIdentity,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import { success, paginated } from "../../../../shared/http/response";
import { TagsService } from "../../application/services/tags.service";
import { skillCommand } from "./skills.controller";
import {
  AdminTagQueryDto,
  AdminTagResponse,
  CreateTagDto,
  UpdateTagDto,
  tagResponse,
} from "./tags.dto";

@ApiTags("tags")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@Controller({ path: "admin/tags", version: "1" })
export class AdminTagsController {
  constructor(private readonly tags: TagsService) {}
  @Get()
  @ApiSuccessResponse(200, AdminTagResponse, { paginated: true })
  async list(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Query() query: AdminTagQueryDto,
  ) {
    const result = await this.tags.adminList(
      skillCommand(req, "read", principal),
      query,
    );
    return paginated(result.data.map(tagResponse), result.pagination);
  }
  @Post()
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiSuccessResponse(201, AdminTagResponse)
  async create(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Body() input: CreateTagDto,
  ) {
    return success(
      tagResponse(
        await this.tags.create(skillCommand(req, key, principal), input),
      ),
    );
  }
  @Patch(":tagId")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiSuccessResponse(200, AdminTagResponse)
  async update(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("tagId", ParseUUIDPipe) id: string,
    @Body() input: UpdateTagDto,
  ) {
    return success(
      tagResponse(
        await this.tags.update(skillCommand(req, key, principal), id, input),
      ),
    );
  }
}
