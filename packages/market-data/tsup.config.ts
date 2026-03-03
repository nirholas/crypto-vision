import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  outDir: 'dist',
  // Don't bundle fetch - use native
  external: [],
  // Environment
  platform: 'neutral', // Works in Node, Edge, and Browser
  esbuildOptions(options) {
    options.banner = {
      js: '/* crypto-market-data - https://github.com/nirholas/crypto-market-data */',
    };
  },
});
