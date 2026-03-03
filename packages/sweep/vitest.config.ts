import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Test environment
    environment: "node",
    
    // Global test setup
    setupFiles: ["./tests/setup.ts"],
    
    // Include test files
    include: ["tests/**/*.test.ts"],
    
    // Exclude patterns
    exclude: ["node_modules", "dist"],
    
    // Test timeout (ms)
    testTimeout: 30000,
    
    // Hook timeout (ms)
    hookTimeout: 30000,
    
    // Run tests in sequence for DB tests
    sequence: {
      shuffle: false,
    },
    
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/types.ts",
        "src/**/index.ts",
        "src/**/*.test.ts",
        "src/workers.ts",
      ],
      thresholds: {
        // Overall thresholds
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
    },
    
    // Global variables available in tests
    globals: true,
    
    // Reporter
    reporters: ["verbose"],
    
    // Pool configuration
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single fork for shared DB state
      },
    },

    // Test type groups for selective running
    typecheck: {
      enabled: false,
    },
  },
  
  // Path aliases matching tsconfig
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
  
  // ESBuild configuration
  esbuild: {
    target: "node20",
  },
});

// Export test group configurations for use with vitest workspaces
export const testGroups = {
  unit: {
    include: ["tests/unit/**/*.test.ts"],
    name: "unit",
  },
  integration: {
    include: ["tests/integration/**/*.test.ts"],
    name: "integration",
  },
  e2e: {
    include: ["tests/e2e/**/*.test.ts"],
    name: "e2e",
  },
  api: {
    include: ["tests/api/**/*.test.ts"],
    name: "api",
  },
  services: {
    include: ["tests/services/**/*.test.ts"],
    name: "services",
  },
};
