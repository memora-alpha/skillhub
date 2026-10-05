if (!process.env.TEST_DATABASE_URL) {
  process.stderr.write(
    "TEST_DATABASE_URL is required for isolated PostgreSQL integration tests.\n",
  );
  process.exitCode = 1;
}
