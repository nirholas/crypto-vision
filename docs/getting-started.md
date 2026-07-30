# Getting started with crypto-vision

The complete cryptocurrency intelligence API - https://nirholas.github.io/crypto-vision/

## Install

```bash
npm install
```

## Verify the install

Clone the repository and run its checks to confirm everything works on your machine:

```bash
git clone https://github.com/nirholas/crypto-vision.git
cd crypto-vision
```

Available commands:

| Command | Runs |
|---|---|
| `npm run dev` | `tsx watch src/index.ts` |
| `npm run build` | `tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json` |
| `npm run start` | `node dist/src/index.js` |
| `npm run lint` | `eslint src/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | `vitest run` |

## Next steps

- [Examples](./examples.md) shows runnable snippets.
- The [README](https://github.com/nirholas/crypto-vision#readme) is the complete reference.
- Found a problem? [Open an issue](https://github.com/nirholas/crypto-vision/issues).
