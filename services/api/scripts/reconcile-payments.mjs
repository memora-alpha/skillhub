import "reflect-metadata";
import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../dist/infrastructure/database/prisma.service.js";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import { PayosTransport } from "../dist/modules/payments/infrastructure/gateway/payos-transport.js";
import { PaymentReconciliationReader } from "../dist/modules/payments/application/services/payment-reconciliation.reader.js";

let db;
try {
  const names = {
    "--user-id": "userId",
    "--payment-id": "paymentId",
    "--order-code": "orderCode",
    "--transaction-id": "transactionId",
    "--limit": "limit",
  };
  const query = {},
    args = process.argv.slice(2);
  let lookup = false;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--lookup-provider" && !lookup) {
      lookup = true;
      continue;
    }
    const name = names[flag],
      value = args[++index];
    if (!name || !value || Object.hasOwn(query, name))
      throw new Error("INVALID_ARGUMENTS");
    query[name] = name === "limit" ? Number(value) : value;
  }
  const config = new ConfigService(process.env);
  db = new PrismaService(config);
  const report = await new PaymentReconciliationReader(
    new TransactionRunner(db),
    new PayosTransport(config),
  ).report(query, lookup);
  console.log(JSON.stringify(report, null, 2));
} catch {
  // Never print raw DB/provider errors, connection strings, QR or credentials.
  console.error(
    "Payment report failed. Use exactly one --user-id/--payment-id/--order-code/--transaction-id, optional --limit 1..100 and --lookup-provider. Check configuration, migrations and DB read access.",
  );
  process.exitCode = 1;
} finally {
  await db?.$disconnect();
}
