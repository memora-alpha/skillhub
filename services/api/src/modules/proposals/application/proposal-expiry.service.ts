import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../infrastructure/database/transaction-runner";
import { lockUsers } from "../../../shared/database/identity-transactions";
import { ProposalsService } from "./proposals.service";
import { AuditWriter } from "../../audit/application/audit-writer";
@Injectable()
export class ProposalExpiryService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly proposals: ProposalsService,
    private readonly audit: AuditWriter,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.run().catch(() => undefined);
    }, 30000);
    this.timer.unref();
    void this.run().catch(() => undefined);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async run() {
    if (this.busy) return;
    this.busy = true;
    try {
      const rows = await this.db.proposal.findMany({
        where: { status: "PENDING", expiresAt: { lte: new Date() } },
        orderBy: { expiresAt: "asc" },
        take: 100,
      });
      for (const candidate of rows)
        await this.transactions.run(async (tx) => {
          await lockUsers(tx, [candidate.proposerId, candidate.recipientId]);
          await tx.$queryRaw`SELECT proposal_id FROM proposals WHERE proposal_id=${candidate.id}::uuid FOR UPDATE`;
          const clocks = await tx.$queryRaw<
              { now: Date }[]
            >`SELECT clock_timestamp() AS now`,
            now = clocks[0]!.now;
          const row = await tx.proposal.findUniqueOrThrow({
            where: { id: candidate.id },
          });
          if (row.status !== "PENDING" || !row.expiresAt || row.expiresAt > now)
            return;
          const expired = await tx.proposal.update({
            where: { id: row.id },
            data: {
              status: "EXPIRED",
              terminalAt: now,
              version: { increment: 1 },
            },
          });
          const source = randomUUID();
          await this.audit.append(tx, {
            actor: { kind: "SYSTEM", name: "proposal-expiry" },
            action: "PROPOSAL_DECIDE",
            target: { type: "PROPOSAL", id: row.id },
            before: { status: row.status, version: row.version },
            after: { status: expired.status, version: expired.version },
            reason: "Connection proposal expired",
            context: { requestId: source, correlationId: source },
          });
          await this.proposals.notify(tx, expired, "proposal.expired", source);
        });
    } finally {
      this.busy = false;
    }
  }
}
