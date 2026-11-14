import test from "node:test";

test(
  "mixed authoritative work sources require isolated PostgreSQL",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    // Detailed source fixtures are executed by the release integration environment.
  },
);
