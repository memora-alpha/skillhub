import type {} from "multer";
import { RemoveAvatarUseCase } from "../../application/use-cases/remove-avatar.use-case";
import { GetAvatarStatusUseCase } from "../../application/use-cases/get-avatar-status.use-case";
import { UploadAvatarUseCase } from "../../application/use-cases/upload-avatar.use-case";
import { GetPublicProfileUseCase } from "../../application/use-cases/get-public-profile.use-case";
import { UpdateProfileUseCase } from "../../application/use-cases/update-profile.use-case";
import { GetOwnIdentityUseCase } from "../../application/use-cases/get-own-identity.use-case";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";

import { ProfileDto } from "./users.dto";
import {
  OwnIdentityResponse,
  OwnProfileResponse,
  PublicProfileResponse,
  AvatarResponse,
} from "./users.responses";

@ApiTags("profiles")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(401)
@ApiErrorResponse(400)
@ApiErrorResponse(429)
@ApiErrorResponse(500)
@ApiErrorResponse(503)
@Controller({ version: "1" })
export class UsersController {
  constructor(
    private readonly getOwnIdentity: GetOwnIdentityUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly getPublicProfile: GetPublicProfileUseCase,
    private readonly uploadAvatar: UploadAvatarUseCase,
    private readonly getAvatarStatus: GetAvatarStatusUseCase,
    private readonly removeAvatar: RemoveAvatarUseCase,
  ) {}
  @Get("me")
  @ApiOperation({ summary: "Read own account and profile allowlist" })
  @ApiSuccessResponse(200, OwnIdentityResponse)
  async own(@CurrentIdentity() actor: Principal) {
    return success(
      await this.getOwnIdentity.execute(actor.userId),
      "Account retrieved.",
    );
  }
  @Patch("me/profile")
  @ApiOperation({ summary: "Update only owned editable profile fields" })
  @ApiSuccessResponse(200, OwnProfileResponse)
  async update(@CurrentIdentity() actor: Principal, @Body() body: ProfileDto) {
    if (
      Object.values(body).every((value) => value === undefined) ||
      Object.values(body).some((value) => value === null)
    )
      throw new BadRequestException("NONEMPTY_PROFILE_REQUIRED");
    return success(
      await this.updateProfile.execute(actor.userId, body),
      "Profile updated.",
    );
  }
  @Get("profiles/:userId")
  @ApiOperation({
    summary: "Read authenticated public ACTIVE profile without private fields",
  })
  @ApiSuccessResponse(200, PublicProfileResponse)
  @ApiErrorResponse(404)
  async public(@Param("userId", ParseUUIDPipe) userId: string) {
    return success(
      await this.getPublicProfile.execute(userId),
      "Profile retrieved.",
    );
  }
  @Post("me/avatar")
  @HttpCode(202)
  @ApiOperation({
    summary: "Quarantine image for durable content inspection and malware scan",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["image"],
      additionalProperties: false,
      properties: { image: { type: "string", format: "binary" } },
    },
  })
  @ApiSuccessResponse(202, AvatarResponse)
  @ApiErrorResponse(413)
  @ApiErrorResponse(415)
  @UseInterceptors(
    FileInterceptor("image", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  async upload(
    @CurrentIdentity() actor: Principal,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return success(
      await this.uploadAvatar.execute(
        actor.userId,
        file
          ? { bytes: file.buffer, mime: file.mimetype, size: file.size }
          : undefined,
      ),
      "Avatar upload accepted.",
    );
  }
  @Get("me/avatar/uploads/:assetId")
  @ApiOperation({ summary: "Read owned upload scan status" })
  @ApiSuccessResponse(200, AvatarResponse)
  @ApiErrorResponse(404)
  async status(
    @CurrentIdentity() actor: Principal,
    @Param("assetId", ParseUUIDPipe) assetId: string,
  ) {
    return success(
      await this.getAvatarStatus.execute(actor.userId, assetId),
      "Avatar upload status retrieved.",
    );
  }
  @Delete("me/avatar")
  @HttpCode(204)
  @ApiOperation({
    summary: "Clear selection and cancel pending uploads with deferred cleanup",
  })
  @ApiResponse({ status: 204 })
  clear(@CurrentIdentity() actor: Principal) {
    return this.removeAvatar.execute(actor.userId);
  }
}
