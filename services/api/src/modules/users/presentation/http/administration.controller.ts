import { RemoveStaffUseCase } from "../../application/use-cases/remove-staff.use-case";
import { AssignStaffUseCase } from "../../application/use-cases/assign-staff.use-case";
import { UnlockUserUseCase } from "../../application/use-cases/unlock-user.use-case";
import { LockUserUseCase } from "../../application/use-cases/lock-user.use-case";
import { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { Principal } from "../../../auth/application/services/sessions.service";

import { ReasonDto, StaffDto, UserListDto } from "./users.dto";
import { AdminUserListResponse } from "./users.responses";
@ApiTags("administration")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiResponse({ status: 401 })
@ApiResponse({ status: 403, description: "Current role/permission denied" })
@ApiResponse({ status: 400 })
@Controller({ path: "admin/users", version: "1" })
export class AdministrationController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly lockUser: LockUserUseCase,
    private readonly unlockUser: UnlockUserUseCase,
    private readonly assignStaff: AssignStaffUseCase,
    private readonly removeStaff: RemoveStaffUseCase,
  ) {}
  @Get()
  @ApiOperation({ summary: "List masked users with context-bound cursor" })
  @ApiResponse({ status: 200, type: AdminUserListResponse })
  list(@CurrentIdentity() actor: Principal, @Query() query: UserListDto) {
    return this.listUsers.execute(actor, query);
  }
  @Post(":userId/lock")
  @HttpCode(204)
  @ApiOperation({
    summary: "Lock ACTIVE account and revoke sessions atomically with audit",
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409 })
  lock(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() body: ReasonDto,
  ) {
    return this.lockUser.execute(actor, userId, body.reason);
  }
  @Post(":userId/unlock")
  @HttpCode(204)
  @ApiOperation({
    summary: "Unlock verified LOCKED account without restoring sessions",
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409 })
  unlock(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() body: ReasonDto,
  ) {
    return this.unlockUser.execute(actor, userId, body.reason);
  }
  @Put(":userId/roles/staff")
  @HttpCode(204)
  @ApiOperation({
    summary: "Admin assigns STAFF using one-use reauthentication",
  })
  @ApiResponse({ status: 204 })
  assign(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() body: StaffDto,
  ) {
    return this.assignStaff.execute(
      actor,
      userId,
      body.reauthToken,
      body.reason,
    );
  }
  @Delete(":userId/roles/staff")
  @HttpCode(204)
  @ApiOperation({
    summary: "Admin removes STAFF using one-use reauthentication",
  })
  @ApiResponse({ status: 204 })
  remove(
    @CurrentIdentity() actor: Principal,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() body: StaffDto,
  ) {
    return this.removeStaff.execute(
      actor,
      userId,
      body.reauthToken,
      body.reason,
    );
  }
}
