import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
export type IdentityTx = Prisma.TransactionClient;
export const transaction = <T>(
  db: PrismaService,
  work: (tx: IdentityTx) => Promise<T>,
): Promise<T> => db.$transaction(work, { timeout: 15000 });
// Lock all participants in UUID order before touching proofs/session rows.
export async function lockUsers(tx: IdentityTx, ids: string[]): Promise<void> {
  for (const id of [...new Set(ids)].sort())
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
}
export async function lockEmail(tx: IdentityTx, email: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${email}, 0))`;
}
