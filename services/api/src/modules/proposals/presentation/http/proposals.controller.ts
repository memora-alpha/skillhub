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
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CurrentIdentity,
  IdentityGuard,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success, paginated } from "../../../../shared/http/response";
import { skillCommand } from "../../../skills/presentation/http/skills.controller";
import { ProposalsService } from "../../application/services/proposals.service";
import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";
import {
  ProposalResponse,
  AcceptedProposalResponse,
} from "./proposals.responses";
import {
  AcceptProposalDto,
  ChangeProposalDto,
  CreateProposalDto,
  DecideProposalDto,
  ProposalQueryDto,
} from "./proposals.dto";
@ApiTags("proposals")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@ApiErrorResponse(429)
@ApiErrorResponse(503)
@ApiHeader({
  name: "Idempotency-Key",
  required: false,
  description: "Required for mutations",
})
@Controller({ path: "proposals", version: "1" })
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}
  @Get()
  @ApiSuccessResponse(200, ProposalResponse, { paginated: true })
  @ApiOperation({ summary: "List sent or received proposals" })
  async list(
    @CurrentIdentity() actor: Principal,
    @Query() query: ProposalQueryDto,
  ) {
    const result = await this.proposals.list(actor, query);
    return paginated(result.data, result.pagination);
  }
  @Get(":id")
  @ApiSuccessResponse(200, ProposalResponse)
  @ApiOperation({ summary: "Read a proposal as a party" })
  async get(
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return success(await this.proposals.get(actor, id));
  }
  @Post()
  @ApiSuccessResponse(201, ProposalResponse)
  @ApiSuccessResponse(200, ProposalResponse)
  @ApiOperation({ summary: "Send a Request proposal or direct invitation" })
  async create(
    @Req() req: IdentityRequest,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentIdentity() actor: Principal,
    @Body() input: CreateProposalDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.proposals.create(
      skillCommand(req, key, actor),
      input,
    );
    res.status(result.replayed ? 200 : 201);
    return success(result.proposal);
  }
  @Patch(":id")
  @ApiSuccessResponse(200, ProposalResponse)
  @ApiOperation({ summary: "Update own pending proposal; expiry is preserved" })
  async update(
    @Req() req: IdentityRequest,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ChangeProposalDto,
  ) {
    return success(
      (
        await this.proposals.mutate(
          skillCommand(req, key, actor),
          id,
          "update",
          input,
        )
      ).proposal,
    );
  }
  @Post(":id/accept")
  @ApiSuccessResponse(200, AcceptedProposalResponse)
  @HttpCode(200)
  @ApiOperation({ summary: "Accept atomically and open a Conversation" })
  async accept(
    @Req() req: IdentityRequest,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AcceptProposalDto,
  ) {
    return success(
      await this.proposals.mutate(
        skillCommand(req, key, actor),
        id,
        "accept",
        input,
      ),
    );
  }
  @Post(":id/reject")
  @ApiSuccessResponse(200, ProposalResponse)
  @HttpCode(200)
  async reject(
    @Req() req: IdentityRequest,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: DecideProposalDto,
  ) {
    return success(
      (
        await this.proposals.mutate(
          skillCommand(req, key, actor),
          id,
          "reject",
          input,
        )
      ).proposal,
    );
  }
  @Post(":id/withdraw")
  @ApiSuccessResponse(200, ProposalResponse)
  @HttpCode(200)
  async withdraw(
    @Req() req: IdentityRequest,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentIdentity() actor: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: DecideProposalDto,
  ) {
    return success(
      (
        await this.proposals.mutate(
          skillCommand(req, key, actor),
          id,
          "withdraw",
          input,
        )
      ).proposal,
    );
  }
}
