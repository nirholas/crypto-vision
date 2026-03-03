import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Database connection singleton
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    // Create postgres client
    client = postgres(connectionString, {
      max: 20, // Connection pool size
      idle_timeout: 20,
      connect_timeout: 10,
    });

    // Create drizzle instance with schema
    db = drizzle(client, { schema });
  }

  return db;
}

// Get the raw postgres client for transactions or raw queries
export function getClient() {
  if (!client) {
    getDb(); // Initialize if not already done
  }
  return client!;
}

// Close database connections (for graceful shutdown)
export async function closeDb() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

// Re-export schema for convenience
export * from "./schema.js";

// Export the db type for use in other modules
export type Database = ReturnType<typeof getDb>;
