// Copies the sql.js wasm so jeep-sqlite works in the browser (dev only).
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';

const src = 'node_modules/sql.js/dist/sql-wasm.wasm';
const dest = 'public/assets/sql-wasm.wasm';
if (existsSync(src)) {
  mkdirSync('public/assets', { recursive: true });
  copyFileSync(src, dest);
  console.log('[copy-wasm] sql-wasm.wasm ready');
}
