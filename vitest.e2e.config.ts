import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "src") + "/",
    },
  },
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    restoreMocks: true,
    globalSetup: ["tests/e2e/global-setup.ts"],
    // Provide E2E_BASE_URL to test files via globalSetup
    pool: "forks",
    poolOptions: {
      forks: {
        // Single fork to share the server connection
        minForks: 1,
        maxForks: 1,
      },
    },
  },
});
