import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsIn, IsISO8601 } from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import { ReasonDto } from "./users.dto";
import { ProfileModerationService } from "../../application/services/profile-moderation.service";
export class ProfileModerationDto extends ReasonDto {
  @ApiProperty({ enum: ["BIO", "AVATAR"] }) @IsIn(["BIO", "AVATAR"]) field!:
    "BIO" | "AVATAR";
  @ApiProperty({ enum: ["HIDE", "REQUEST_EDIT"] })
  @IsIn(["HIDE", "REQUEST_EDIT"])
  action!: "HIDE" | "REQUEST_EDIT";
  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;
}
export class ProfileModerationResult {
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
  @ApiProperty({ type: Object, nullable: true }) moderation!: unknown;
}
export class ProfileModerationView extends ProfileModerationResult {
  @ApiProperty({ type: String, nullable: true }) bio!: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
}
@ApiTags("profile-moderation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@ApiErrorResponse(409)
@Controller({ path: "staff/users/:userId/profile-moderation", version: "1" })
export class ProfileModerationController {
  constructor(private readonly profiles: ProfileModerationService) {}
  @Get()
  @ApiSuccessResponse(200, ProfileModerationView)
  async read(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) userId: string,
  ) {
    return success(await this.profiles.read(actor, userId));
  }
  @Post()
  @ApiSuccessResponse(201, ProfileModerationResult)
  async change(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: ProfileModerationDto,
  ) {
    return success(await this.profiles.change(actor, userId, input));
  }
}
