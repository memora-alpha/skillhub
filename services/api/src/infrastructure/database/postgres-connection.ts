/** Prisma's pg timestamp parser expects the PostgreSQL session to use UTC. */
export function postgresConnectionString(
  connectionString: string,
  environmentOptions = process.env.PGOPTIONS ?? "",
): string {
  let url: URL;
  try {
    url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  } catch {
    // A malformed connection string can contain credentials; never echo it.
    throw new Error("Invalid PostgreSQL connection configuration");
  }
  const options =
    url.searchParams.getAll("options").join(" ") || environmentOptions;
  // Set it in the URL: pg connection-string options override PoolConfig.options.
  // The final timezone setting wins while preserving other PostgreSQL options.
  url.searchParams.set("options", `${options} -c timezone=UTC`.trim());
  return url.toString();
}
