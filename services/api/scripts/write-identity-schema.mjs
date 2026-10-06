// Compatibility entry point for db:migrate. Identity is now maintained separately:
// extracting it from the v3 catalog would break current repositories/migrations.
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../prisma/identity.prisma", import.meta.url),
  "utf8",
);
for (const name of ["User", "Profile", "UserRole", "OtpChallenge"]) {
  if (!source.includes(`model ${name} {`)) {
    throw new Error(
      `Identity runtime schema is missing ${name}; migrate runtime explicitly before changing deployment scope.`,
    );
  }
}
console.log(
  "Using separately maintained prisma/identity.prisma; no extraction from the v3 catalog.",
);
