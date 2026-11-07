import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  MaxLength,
} from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  CLAIMABLE_MISSIONS,
  RecoveryService,
} from "../../application/services/recovery.service";

class QuizDto {
  @IsString()
  @MaxLength(20)
  version!: string;

  @IsArray()
  @ArrayMaxSize(5)
  @IsBoolean({ each: true })
  answers!: boolean[];
}

class MissionDto {
  @IsIn(CLAIMABLE_MISSIONS)
  code!: (typeof CLAIMABLE_MISSIONS)[number];
}

@ApiTags("reputation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "reputation/recovery", version: "1" })
export class RecoveryController {
  constructor(private readonly recovery: RecoveryService) {}

  @Get()
  async mine(@CurrentIdentity() actor: Principal) {
    return success(
      await this.recovery.mine(actor.userId),
      "Recovery missions retrieved.",
    );
  }

  @Post("quiz")
  async quiz(@CurrentIdentity() actor: Principal, @Body() body: QuizDto) {
    return success(
      await this.recovery.submitQuiz(actor.userId, body.version, body.answers),
      "Quiz evaluated.",
    );
  }

  @Post("claim")
  async claim(@CurrentIdentity() actor: Principal, @Body() body: MissionDto) {
    return success(
      await this.recovery.claim(actor.userId, body.code),
      "Mission evaluated.",
    );
  }
}
