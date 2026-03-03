import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import "dotenv/config";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🔄 Starting database migration...");
  console.log(`📍 Database: ${databaseUrl.replace(/:[^:@]+@/, ":****@")}`);

  // Create connection with migration-specific settings
  const client = postgres(databaseUrl, {
    max: 1,
    onnotice: () => {}, // Suppress notices
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = drizzle(client as any);

    console.log("📂 Running migrations from: ./drizzle/migrations");

    await migrate(db, {
      migrationsFolder: "./drizzle/migrations",
    });

    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:");

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes("ECONNREFUSED")) {
        console.error(
          "   Could not connect to database. Is PostgreSQL running?"
        );
        console.error("   Try: docker compose up -d postgres");
      } else if (error.message.includes("does not exist")) {
        console.error("   Database or table does not exist.");
        console.error("   Try: npm run db:push to create the schema");
      } else if (error.message.includes("authentication failed")) {
        console.error("   Database authentication failed.");
        console.error("   Check your DATABASE_URL credentials");
      } else {
        console.error(`   ${error.message}`);
      }
    } else {
      console.error(error);
    }

    process.exit(1);
  } finally {
    await client.end();
    console.log("🔌 Database connection closed");
  }
}

// Run migrations
runMigrations();
