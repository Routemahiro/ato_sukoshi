import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const upload = resolve(root, 'ato-sukoshi-assets/elephant/upload');
const nextGen = resolve(root, 'ato-sukoshi-assets/elephant/next-gen');
const assetsPath = resolve(root, 'src/assets.js');

const mime = {
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
};

function toDataUrl(filePath, name) {
  const ext = name.slice(name.lastIndexOf('.'));
  const type = mime[ext];
  if (!type) throw new Error(`Unsupported type: ${name}`);
  const base64 = readFileSync(filePath).toString('base64');
  return `data:${type};base64,${base64}`;
}

function mergeAsset(assets, name, filePath) {
  if (!existsSync(filePath)) throw new Error(`Missing asset file: ${filePath}`);
  assets[name] = toDataUrl(filePath, name);
}

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(assetsPath, 'utf8'), sandbox, { timeout: 2000 });
const assets = { ...sandbox.window.TimerAssets };

const imported = [];
const chewAdditions = [
  'apple.svg',
  'elephant-ready.webp',
  ...Array.from({ length: 9 }, (_, i) => `elephant-chew-${i}.webp`),
];
for (const name of chewAdditions) {
  const filePath = resolve(upload, name);
  if (!existsSync(filePath)) continue;
  mergeAsset(assets, name, filePath);
  imported.push(name);
}

const nextScenes = ['tidy', 'meal', 'bath', 'out', 'brush', 'sleep'].map(
  (scene) => `elephant-next-${scene}.webp`,
);
for (const name of nextScenes) {
  mergeAsset(assets, name, resolve(nextGen, name));
  imported.push(name);
}

const keys = Object.keys(assets).sort();
const body = keys.map((key) => `"${key}":"${assets[key]}"`).join(',');
writeFileSync(assetsPath, `window.TimerAssets=(()=>{const a={${body}};return a;})();\n`);
console.log(`Updated ${assetsPath} with ${imported.length} theme assets (${keys.length} total).`);
