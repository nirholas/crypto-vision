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
    include: ["tests/**/*.test.ts", "src/lib/__tests__/**/*.test.ts", "src/routes/__tests__/**/*.test.ts"],
    exclude: ["node_modules", "dist", "apps", "packages", "tests/e2e/**"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    restoreMocks: true,
    sequence: { shuffle: false },
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/routes/**/*.ts"],
      exclude: ["**/*.test.ts", "**/__tests__/**"],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 45,
        lines: 50,
      },
    },
  },
});
