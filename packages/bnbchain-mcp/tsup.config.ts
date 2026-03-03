/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    lib: 'src/lib.ts',
    index: 'src/index.ts'
  },
  format: ['esm'],
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [
    '@modelcontextprotocol/sdk',
    'viem',
    'zod',
    'express',
    'cors',
    'dotenv',
    'reflect-metadata'
  ],
  noExternal: [
    '@bnb-chain/greenfield-js-sdk',
    '@bnb-chain/greenfield-cosmos-types',
    '@bnb-chain/reed-solomon',
    'mime'
  ],
  esbuildOptions(options) {
    options.alias = {
      '@': './src'
    }
    // Inject CJS compatibility shims for bundled packages that use require()/__dirname in ESM
    options.banner = {
      js: "import { createRequire } from 'module'; import { fileURLToPath as __tsup_fileURLToPath } from 'url'; import { dirname as __tsup_dirname } from 'path'; const require = createRequire(import.meta.url); const __filename = __tsup_fileURLToPath(import.meta.url); const __dirname = __tsup_dirname(__filename);"
    }
  }
})
