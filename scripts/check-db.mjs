import fs from "fs";
import { createClient } from "@libsql/client";

const envFile = fs.readFileSync(".dev.vars", "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
}

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

async function main() {
  const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
  console.log("Current tables in DB:", res.rows.map(r => r.name));
}

main().catch(console.error);
