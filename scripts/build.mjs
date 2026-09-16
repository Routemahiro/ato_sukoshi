import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(resolve(root, 'src/index.template.html'), 'utf8');
for (const [token, file] of Object.entries({
  '__STYLES__': 'styles.css', '__TIMER_CORE__': 'timer-core.js',
  '__SNACK_CORE__': 'snack-core.js', '__ASSETS__': 'assets.js', '__APP__': 'app.js'
})) {
  if (html.split(token).length !== 2) throw new Error(`Expected exactly one ${token}`);
  html = html.replace(token, () => readFileSync(resolve(root, 'src', file), 'utf8'));
}
const output = Buffer.from(html, 'utf8');
if (process.argv.includes('--check')) {
  if (!readFileSync(resolve(root, 'index.html')).equals(output)) {
    console.error('index.html is out of date. Run npm run build.'); process.exit(1);
  }
  console.log('PASS: distribution is byte-identical to editable sources.');
} else {
  writeFileSync(resolve(root, 'index.html'), output);
  console.log(`Built index.html (${output.length} bytes).`);
}
console.log(`SHA-256: ${createHash('sha256').update(output).digest('hex')}`);
