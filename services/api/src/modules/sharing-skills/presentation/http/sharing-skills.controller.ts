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
import {
  ApiTags,
  ApiBearerAuth,
  ApiHeader,
  ApiProperty,
} from "@nestjs/swagger";
import {
  IdentityGuard,
  CurrentIdentity,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success, paginated } from "../../../../shared/http/response";
import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";
import { skillCommand } from "../../../skills/presentation/http/skills.controller";
import {
  VersionDto,
  PageDto,
} from "../../../skills/presentation/http/skills.dto";
import {
  SharingResponse,
  PublicSharingResponse,
} from "../../../skills/presentation/http/skills.responses";
import { SharingSkillsService } from "../../application/services/sharing-skills.service";
import {
  CreateSharingDto,
  ChangeSharingDto,
  SharingQueryDto,
  SharerQueryDto,
} from "./sharing-skills.dto";
class SharerResponse extends PublicSharingResponse {
  @ApiProperty({ type: Object }) user!: unknown;
}
@ApiTags("sharing-skills")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@ApiHeader({
  name: "Idempotency-Key",
  required: false,
  description: "Required for mutations",
})
@Controller({ path: "me/skills", version: "1" })
export class SharingSkillsController {
  constructor(private readonly sharing: SharingSkillsService) {}
  @Get()
  @ApiSuccessResponse(200, SharingResponse, { paginated: true })
  async list(
    @CurrentIdentity() principal: Principal,
    @Query() query: SharingQueryDto,
  ) {
    const r = await this.sharing.ownList(principal, query);
    return paginated(r.data, r.pagination);
  }
  @Post()
  @ApiSuccessResponse(201, SharingResponse)
  async create(
    @Req() req: IdentityRequest,
    @CurrentIdentity() p: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: CreateSharingDto,
  ) {
    return success(await this.sharing.create(skillCommand(req, key, p), body));
  }
  @Patch(":sharingSkillId")
  @ApiSuccessResponse(200, SharingResponse)
  async change(
    @Req() req: IdentityRequest,
    @CurrentIdentity() p: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("sharingSkillId", ParseUUIDPipe) id: string,
    @Body() body: ChangeSharingDto,
  ) {
    if (
      Object.keys(body).length === 1 ||
      body.description === null ||
      body.level === null ||
      body.isVisible === null
    )
      throw new BadRequestException("INVALID_SHARING_PATCH");
    return success(
      await this.sharing.change(skillCommand(req, key, p), id, body),
    );
  }
  @Post(":sharingSkillId/archive")
  @HttpCode(200)
  @ApiSuccessResponse(200, SharingResponse)
  async archive(
    @Req() req: IdentityRequest,
    @CurrentIdentity() p: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("sharingSkillId", ParseUUIDPipe) id: string,
    @Body() body: VersionDto,
  ) {
    return success(
      await this.sharing.change(skillCommand(req, key, p), id, body, true),
    );
  }
  @Post(":sharingSkillId/restore")
  @HttpCode(200)
  @ApiSuccessResponse(200, SharingResponse)
  async restore(
    @Req() req: IdentityRequest,
    @CurrentIdentity() p: Principal,
    @Headers("idempotency-key") key: string | undefined,
    @Param("sharingSkillId", ParseUUIDPipe) id: string,
    @Body() body: VersionDto,
  ) {
    return success(
      await this.sharing.restore(skillCommand(req, key, p), id, body),
    );
  }
}
@ApiTags("skill-search")
@Controller({ version: "1" })
export class SkillSearchController {
  constructor(private readonly sharing: SharingSkillsService) {}
  @Get("skills/:skillId/sharers")
  @ApiBearerAuth()
  @UseGuards(IdentityGuard)
  @ApiSuccessResponse(200, SharerResponse, { paginated: true })
  async sharers(
    @CurrentIdentity() p: Principal,
    @Param("skillId", ParseUUIDPipe) id: string,
    @Query() query: SharerQueryDto,
  ) {
    const r = await this.sharing.search(p, id, query);
    return paginated(r.data, r.pagination);
  }
  @Get("profiles/:userId/skills")
  @ApiSuccessResponse(200, PublicSharingResponse, { paginated: true })
  async profile(
    @Param("userId", ParseUUIDPipe) id: string,
    @Query() query: PageDto,
  ) {
    const r = await this.sharing.publicList(id, query);
    return paginated(r.data, r.pagination);
  }
}
