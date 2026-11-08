import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";
import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import { NotificationPreferencesService } from "../../application/services/notification-preferences.service";
export class NotificationPreferencesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() learning?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() credit?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() community?: boolean;
}
export class NotificationPreferencesResponse {
  @ApiProperty() learning!: boolean;
  @ApiProperty() credit!: boolean;
  @ApiProperty() community!: boolean;
}
@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@Controller({ path: "me/notification-preferences", version: "1" })
export class NotificationPreferencesController {
  constructor(private readonly preferences: NotificationPreferencesService) {}
  @Get()
  @ApiSuccessResponse(200, NotificationPreferencesResponse)
  async read(@CurrentIdentity() actor: Principal) {
    return success(await this.preferences.read(actor));
  }
  @Patch()
  @ApiSuccessResponse(200, NotificationPreferencesResponse)
  async update(
    @CurrentIdentity() actor: Principal,
    @Body() body: NotificationPreferencesDto,
  ) {
    return success(await this.preferences.update(actor, body));
  }
}
