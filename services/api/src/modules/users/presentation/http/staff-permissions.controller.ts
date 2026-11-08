import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import { IsIn, IsInt, IsString, Length, Min } from "class-validator";
import {
  IdentityGuard,
  CurrentIdentity,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { success } from "../../../../shared/http/response";
import { StaffPermissionService } from "../../application/services/staff-permission.service";
import { StaffDto } from "./users.dto";

export class StaffPermissionChangeDto extends StaffDto {
  @ApiProperty({ enum: ["GRANT", "DENY", "RESET"] })
  @IsIn(["GRANT", "DENY", "RESET"])
  effect!: "GRANT" | "DENY" | "RESET";
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  expectedVersion!: number;
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @Length(1, 1000)
  declare reason: string;
}

@ApiTags("staff-permissions")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "admin/staff-permissions", version: "1" })
export class StaffPermissionsController {
  constructor(private readonly permissions: StaffPermissionService) {}
  @Get("catalog")
  @ApiOperation({ summary: "Read operational permissions delegable to Staff" })
  async catalog(@CurrentIdentity() actor: Principal) {
    return success(await this.permissions.catalog(actor));
  }
  @Get(":userId")
  @ApiOperation({
    summary: "Read current Staff permissions, overrides and version",
  })
  async read(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) id: string,
  ) {
    return success(await this.permissions.read(actor, id));
  }
  @Put(":userId/:code")
  @ApiOperation({
    summary:
      "Admin grants, denies or resets a Staff permission; invalidates target sessions",
  })
  async change(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) id: string,
    @Param("code") code: string,
    @Body() input: StaffPermissionChangeDto,
  ) {
    return success(await this.permissions.change(actor, id, code, input));
  }
}
