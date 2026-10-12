import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { paginated } from "../../../../shared/http/response";
import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../../shared/http/api-response.decorators";
import {
  ListNotificationsUseCase,
  MarkNotificationReadUseCase,
} from "../../application/use-cases/notification-inbox.use-cases";
import { ListNotificationsDto } from "./notifications.dto";
import { NotificationResponse } from "./notifications.responses";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@ApiErrorResponse(400)
@ApiErrorResponse(401)
@ApiErrorResponse(403)
@ApiErrorResponse(404)
@Controller({ path: "notifications", version: "1" })
export class NotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly markNotificationRead: MarkNotificationReadUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated user's notifications" })
  @ApiSuccessResponse(200, NotificationResponse, { paginated: true })
  async list(
    @CurrentIdentity() actor: Principal,
    @Query() query: ListNotificationsDto,
  ) {
    const page = await this.listNotifications.execute(actor, query);
    return paginated(
      page.items,
      {
        nextCursor: page.nextCursor,
        hasMore: page.nextCursor !== null,
        limit: query.limit ?? 20,
      },
      "Notifications loaded.",
    );
  }

  @Patch(":notificationId/read")
  @ApiParam({ name: "notificationId", format: "uuid" })
  @HttpCode(204)
  @ApiOperation({
    summary: "Mark one of the authenticated user's notifications as read",
  })
  @ApiNoContentResponse()
  async markRead(
    @CurrentIdentity() actor: Principal,
    @Param("notificationId", ParseUUIDPipe) notificationId: string,
  ) {
    await this.markNotificationRead.execute(actor, notificationId);
  }
}
