import {
  Body,
  Controller,
  Get,
  HttpCode,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import {
  getOrCreateRequestContext,
  type ContextualRequest,
} from "../../../../shared/http/request-context";
import { ApiErrorResponse } from "../../../../shared/http/api-response.decorators";
import { success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { defaultProfanityRuleSet } from "../../../content-moderation/domain/profanity-rule-set";
import { ProfanityRulesUseCase } from "../../application/use-cases/profanity-rules.use-case";

const rulesExample = [
  ...defaultProfanityRuleSet.rules,
  { id: "vi-example", term: "cá tím", aliases: ["ca tim"], enabled: true },
];

@ApiTags("global-profanity-rules")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(409)
@ApiErrorResponse(503)
@Controller({ path: "admin/content-moderation/profanity-rules", version: "1" })
export class ProfanityRulesController {
  constructor(private readonly rules: ProfanityRulesUseCase) {}

  @Get()
  @ApiOperation({ summary: "Read the active rules and version" })
  async get(@CurrentIdentity() actor: Principal) {
    return success(await this.rules.get(actor), "Profanity rules retrieved.");
  }

  @Put()
  @ApiOperation({ summary: "Apply a complete rule set immediately" })
  @ApiBody({
    schema: {
      type: "object",
      example: {
        expectedVersion: 1,
        rules: rulesExample,
        reason: "Update rule set",
      },
    },
  })
  async update(
    @CurrentIdentity() actor: Principal,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    return success(
      await this.rules.update(
        actor,
        body,
        getOrCreateRequestContext(request as Request & ContextualRequest),
      ),
      "Profanity rules applied.",
    );
  }

  @Post("preview")
  @HttpCode(200)
  @ApiOperation({ summary: "Test a draft rule set without applying it" })
  @ApiBody({
    schema: {
      type: "object",
      example: { rules: rulesExample, text: "Bài tập cá tím" },
    },
  })
  async preview(@CurrentIdentity() actor: Principal, @Body() body: unknown) {
    return success(
      await this.rules.preview(actor, body),
      "Profanity rules tested.",
    );
  }

  @Get("revisions")
  @ApiQuery({ name: "before", required: false, type: Number })
  async revisions(
    @CurrentIdentity() actor: Principal,
    @Query("before", new ParseIntPipe({ optional: true })) before?: number,
  ) {
    return success(
      await this.rules.revisions(actor, before),
      "Profanity revisions retrieved.",
    );
  }

  @Post("rollback")
  @HttpCode(200)
  @ApiErrorResponse(404)
  @ApiBody({
    schema: {
      type: "object",
      example: {
        expectedVersion: 2,
        targetVersion: 1,
        reason: "Restore prior rules",
      },
    },
  })
  async rollback(
    @CurrentIdentity() actor: Principal,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    return success(
      await this.rules.rollback(
        actor,
        body,
        getOrCreateRequestContext(request as Request & ContextualRequest),
      ),
      "Profanity rules restored.",
    );
  }
}
