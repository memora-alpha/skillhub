export function redisConnectionOptions(connectionUrl: string) {
  const url = new URL(connectionUrl);
  const database = Number(url.pathname.slice(1) || 0);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error("REDIS_URL must use a nonnegative integer database index");
  }
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: database,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
