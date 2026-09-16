import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(resolve(root, 'src/assets.js'), 'utf8'), sandbox, { timeout: 2000 });
const directory = resolve(root, 'assets-export'); mkdirSync(directory, { recursive: true });
for (const [name, uri] of Object.entries(sandbox.window.TimerAssets)) {
  if (basename(name) !== name) throw new Error('Unexpected asset name');
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(uri);
  if (!match) throw new Error(`Unexpected data URL: ${name}`);
  writeFileSync(resolve(directory, name), Buffer.from(match[2], 'base64'));
  console.log(name);
}
console.log('Export only: src/assets.js remains the authoritative asset source.');
