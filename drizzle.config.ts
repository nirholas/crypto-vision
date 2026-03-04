import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/bot/db/schema.ts",
  out: "./src/bot/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://localhost:5432/cryptovision",
  },
});
