import { mongo } from "mongoose";
import { setTimeout as delay } from "node:timers/promises";
process.loadEnvFile();
const name = process.argv[2] ?? "rs0";
const uri = new URL(process.env.MONGODB_URI);
if (
  uri.protocol !== "mongodb:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname) ||
  !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(name)
)
  throw new Error("LOCAL_MONGO_AND_VALID_REPLICA_SET_REQUIRED");
uri.searchParams.delete("replicaSet");
uri.searchParams.set("directConnection", "true");
const client = new mongo.MongoClient(uri.toString(), {
  serverSelectionTimeoutMS: 5000,
});
try {
  await client.connect();
  const admin = client.db().admin();
  const options = await admin.command({ getCmdLineOpts: 1 });
  if (options.parsed?.replication?.replSetName !== name)
    throw new Error("MONGO_SERVICE_REPLICA_SET_CONFIG_REQUIRED");
  try {
    const existing = await admin.command({ replSetGetConfig: 1 });
    if (existing.config._id !== name)
      throw new Error("EXISTING_REPLICA_SET_NAME_MISMATCH");
    console.log("Replica set already initialized; config preserved.");
  } catch (error) {
    if (error.code !== 94) throw error;
    await admin.command({
      replSetInitiate: {
        _id: name,
        members: [{ _id: 0, host: `localhost:${uri.port || "27017"}` }],
      },
    });
    console.log(`Initialized local single-member replica set ${name}.`);
  }
  const end = Date.now() + 60000;
  let ready = false;
  while (Date.now() < end) {
    const hello = await admin.command({ hello: 1 });
    if (hello.setName === name && hello.isWritablePrimary) {
      ready = true;
      break;
    }
    await delay(500);
  }
  if (!ready) throw new Error("MONGO_PRIMARY_ELECTION_TIMEOUT");
  console.log(`Replica set ${name} is writable PRIMARY.`);
} catch (error) {
  console.error(
    `Local replica-set setup failed: ${error.codeName ?? error.code ?? error.message?.match(/^[A-Z_]+$/)?.[0] ?? error.name}`,
  );
  process.exitCode = 1;
} finally {
  await client.close();
}
