import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { TagRequestsService } from "../../application/services/tag-requests.service";
import { skillCommand } from "./skills.controller";
import {
  ApproveTagRequestDto,
  CreateTagDto,
  RejectTagRequestDto,
  TagRequestQueryDto,
  TagRequestResponse,
  tagRequestResponse,
} from "./tags.dto";

@ApiTags("tag-requests")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(409)
@Controller({ path: "tag-requests", version: "1" })
export class TagRequestsController {
  constructor(private readonly requests: TagRequestsService) {}
  @Post()
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiSuccessResponse(201, TagRequestResponse)
  async create(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Body() input: CreateTagDto,
  ) {
    return success(
      tagRequestResponse(
        await this.requests.create(skillCommand(req, key, principal), input),
      ),
    );
  }
}

@ApiTags("tag-requests")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@Controller({ path: "me/tag-requests", version: "1" })
export class MyTagRequestsController {
  constructor(private readonly requests: TagRequestsService) {}
  @Get()
  @ApiSuccessResponse(200, TagRequestResponse, { paginated: true })
  async list(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Query() query: TagRequestQueryDto,
  ) {
    const result = await this.requests.mine(
      skillCommand(req, "read", principal),
      query,
    );
    return paginated(result.data.map(tagRequestResponse), result.pagination);
  }
  @Get(":requestId")
  @ApiSuccessResponse(200, TagRequestResponse)
  async detail(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Param("requestId", ParseUUIDPipe) id: string,
  ) {
    return success(
      tagRequestResponse(
        await this.requests.mineDetail(
          skillCommand(req, "read", principal),
          id,
        ),
      ),
    );
  }
}

@ApiTags("tag-requests")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@Controller({ path: "admin/tag-requests", version: "1" })
export class AdminTagRequestsController {
  constructor(private readonly requests: TagRequestsService) {}
  @Get()
  @ApiSuccessResponse(200, TagRequestResponse, { paginated: true })
  async list(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Query() query: TagRequestQueryDto,
  ) {
    const result = await this.requests.adminList(
      skillCommand(req, "read", principal),
      query,
    );
    return paginated(result.data.map(tagRequestResponse), result.pagination);
  }
  @Get(":requestId")
  @ApiSuccessResponse(200, TagRequestResponse)
  async detail(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Param("requestId", ParseUUIDPipe) id: string,
  ) {
    return success(
      tagRequestResponse(
        await this.requests.adminDetail(
          skillCommand(req, "read", principal),
          id,
        ),
      ),
    );
  }
  @Post(":requestId/approve")
  @HttpCode(200)
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiSuccessResponse(200, TagRequestResponse)
  async approve(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("requestId", ParseUUIDPipe) id: string,
    @Body() input: ApproveTagRequestDto,
  ) {
    return success(
      tagRequestResponse(
        await this.requests.approve(
          skillCommand(req, key, principal),
          id,
          input,
        ),
      ),
    );
  }
  @Post(":requestId/reject")
  @HttpCode(200)
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiSuccessResponse(200, TagRequestResponse)
  async reject(
    @Req() req: IdentityRequest,
    @CurrentIdentity() principal: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("requestId", ParseUUIDPipe) id: string,
    @Body() input: RejectTagRequestDto,
  ) {
    return success(
      tagRequestResponse(
        await this.requests.reject(
          skillCommand(req, key, principal),
          id,
          input,
        ),
      ),
    );
  }
}
