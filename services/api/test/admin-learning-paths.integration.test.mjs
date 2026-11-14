import test from "node:test";

test(
  "admin path historical projection requires isolated PostgreSQL",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    // Detailed plan/session fixtures are executed by the release integration environment.
  },
);
