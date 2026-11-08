import { Module } from "@nestjs/common";
import { SessionOverviewReader } from "./application/services/session-overview.reader";
@Module({
  providers: [SessionOverviewReader],
  exports: [SessionOverviewReader],
})
export class SessionOverviewModule {}
