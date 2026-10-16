import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import { PushTokensUseCases } from "../../application/use-cases/push-tokens.use-cases";
import { RegisterPushTokenDto } from "./notifications.dto";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "notifications/push-tokens", version: "1" })
export class PushTokensController {
  constructor(private readonly pushTokens: PushTokensUseCases) {}

  @Post()
  @ApiOperation({ summary: "Register this browser's FCM token for web push" })
  async register(
    @CurrentIdentity() actor: Principal,
    @Body() body: RegisterPushTokenDto,
  ) {
    return success(
      await this.pushTokens.register(actor, body.token),
      "Push token registered.",
    );
  }

  @Delete(":tokenId")
  @HttpCode(204)
  @ApiOperation({ summary: "Stop web push to a registered browser" })
  async unregister(
    @CurrentIdentity() actor: Principal,
    @Param("tokenId", ParseUUIDPipe) tokenId: string,
  ): Promise<void> {
    await this.pushTokens.unregister(actor, tokenId);
  }
}
