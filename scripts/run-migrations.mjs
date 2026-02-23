import pg from "pg";
import fs from "fs";
import path from "path";
import dns from "dns";
import { fileURLToPath } from "url";

// Force IPv4
dns.setDefaultResultOrder("ipv4first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
const password = process.env.DB_PASSWORD;

const regions = [
  "eu-central-1",
  "us-east-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "us-west-1",
  "us-west-2",
  "ap-southeast-1",
  "ap-northeast-1",
  "ap-south-1",
  "sa-east-1",
  "us-east-2",
  "ap-southeast-2",
  "ca-central-1",
  "eu-north-1",
];

const connectionConfigs = [
  // Direct connection (IPv4 forced)
  {
    label: "Direct connection (IPv4)",
    connectionString: `postgresql://postgres:${password}@db.zlixmfcppzvbayyjymrv.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  },
  // Try new pooler format without region
  {
    label: "New pooler format",
    connectionString: `postgresql://postgres.zlixmfcppzvbayyjymrv:${password}@pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  },
  // Try all regions with session mode (port 5432)
  ...regions.map((r) => ({
    label: `Pooler ${r} port 5432`,
    connectionString: `postgresql://postgres.zlixmfcppzvbayyjymrv:${password}@aws-0-${r}.pooler.supabase.com:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  })),
  // Try all regions with transaction mode (port 6543)
  ...regions.map((r) => ({
    label: `Pooler ${r} port 6543`,
    connectionString: `postgresql://postgres.zlixmfcppzvbayyjymrv:${password}@aws-0-${r}.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })),
];

async function tryConnect(config) {
  const client = new pg.Client({
    connectionString: config.connectionString,
    ssl: config.ssl,
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

async function main() {
  if (!password) {
    console.error("Set DB_PASSWORD env var");
    process.exit(1);
  }

  let client;
  for (const config of connectionConfigs) {
    try {
      process.stdout.write(`Trying ${config.label}... `);
      client = await tryConnect(config);
      console.log("✅ Connected!");
      break;
    } catch (err) {
      console.log(`❌ ${err.message.substring(0, 60)}`);
    }
  }

  if (!client) {
    console.error("\nCould not connect to database with any config");
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    console.log(`\n📄 Running ${file}...`);
    try {
      await client.query(sql);
      console.log(`  ✅ ${file} applied successfully`);
    } catch (err) {
      console.error(`  ❌ ${file} failed: ${err.message}`);
    }
  }

  await client.end();
  console.log("\n🎉 Migrations complete!");
}

main().catch(console.error);
