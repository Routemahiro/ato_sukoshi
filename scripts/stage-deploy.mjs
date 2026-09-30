import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shippedFiles } from './shipped-files.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'deploy');
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest);
for (const file of shippedFiles) {
  copyFileSync(resolve(root, file.source), resolve(dest, file.name));
}
process.stdout.write(`${readdirSync(dest).sort().join('\n')}\n`);
