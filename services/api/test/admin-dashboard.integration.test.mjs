import test from "node:test";

test(
  "admin dashboard aggregate fixtures require isolated PostgreSQL",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    // The shared integration harness applies migrations before feature fixtures.
  },
);
