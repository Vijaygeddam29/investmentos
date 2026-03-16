import path from "path";
import { fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await mkdir(distDir, { recursive: true });

  // Write a CJS launcher that resolves all paths at RUNTIME (not build time)
  // so the same launcher works in both dev and production environments.
  // Avoids ESM/CJS bundling issues with packages like openai and drizzle-orm.
  const launcher = `'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

// __dirname at runtime = artifacts/api-server/dist
const tsxBin   = path.resolve(__dirname, '../node_modules/.bin/tsx');
const srcEntry = path.resolve(__dirname, '../src/index.ts');

const result = spawnSync(
  tsxBin,
  [srcEntry],
  { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } }
);

process.exit(result.status ?? 1);
`;

  await writeFile(path.resolve(distDir, "index.cjs"), launcher);
  console.log("Build complete — launcher written to dist/index.cjs");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
