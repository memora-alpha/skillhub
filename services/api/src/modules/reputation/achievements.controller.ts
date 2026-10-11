import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../shared/auth/identity.guard";
import type { Principal } from "../auth/application/services/sessions.service";
import { success } from "../../shared/http/response";
import { AchievementsService } from "./achievements.service";

class SelectAchievementTitleDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;
}

@ApiTags("achievements")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "me/achievements", version: "1" })
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's unlocked achievements" })
  async mine(@CurrentIdentity() actor: Principal) {
    return success(
      await this.achievements.mine(actor),
      "Achievements retrieved.",
    );
  }

  @Patch("selected-title")
  @ApiOperation({ summary: "Select an unlocked achievement title or clear it" })
  async selectTitle(
    @CurrentIdentity() actor: Principal,
    @Body() body: SelectAchievementTitleDto,
  ) {
    return success(
      await this.achievements.selectTitle(actor, body.code ?? null),
      "Selected title updated.",
    );
  }
}
