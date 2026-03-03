import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@/": path.resolve(__dirname) + "/",
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "lib/__tests__/**/*.test.ts", "routes/__tests__/**/*.test.ts"],
    exclude: ["node_modules", "dist", "apps", "packages"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    restoreMocks: true,
    sequence: { shuffle: false },
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "routes/**/*.ts"],
      exclude: ["**/*.test.ts", "**/__tests__/**"],
    },
  },
});
