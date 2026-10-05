import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { transaction } from "../../../../shared/database/identity-transactions";
import { Injectable } from "@nestjs/common";
import { Principal } from "../../../auth/application/services/sessions.service";
import { StaffRoleChangeService } from "../services/staff-role-change.service";
@Injectable()
export class AssignStaffUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly change: StaffRoleChangeService,
  ) {}
  execute(actor: Principal, userId: string, proof: string, reason: string) {
    return transaction(this.db, (tx) =>
      this.change.execute(tx, actor, userId, true, proof, reason),
    );
  }
}
