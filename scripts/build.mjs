import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GA_MEASUREMENT_ID } from '../src/ga-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const appVersion = pkg.version;
const checkMode = process.argv.includes('--check');

const outputs = [
  {
    name: 'index.html',
    build() {
      let html = readFileSync(resolve(root, 'src/index.template.html'), 'utf8');
      const gaToken = '__GA_MEASUREMENT_ID__';
      if (html.split(gaToken).length !== 3) throw new Error(`Expected exactly two ${gaToken}`);
      html = html.split(gaToken).join(GA_MEASUREMENT_ID);
      const versionToken = '__APP_VERSION__';
      if (html.split(versionToken).length !== 2) throw new Error(`Expected exactly one ${versionToken}`);
      html = html.replace(versionToken, appVersion);
      for (const [token, file] of Object.entries({
        '__STYLES__': 'styles.css', '__TIMER_CORE__': 'timer-core.js',
        '__SNACK_CORE__': 'snack-core.js', '__ASSETS__': 'assets.js',
        '__STAGE_MODEL__': 'stage-model.js', '__APP__': 'app.js'
      })) {
        if (html.split(token).length !== 2) throw new Error(`Expected exactly one ${token}`);
        html = html.replace(token, () => readFileSync(resolve(root, 'src', file), 'utf8'));
      }
      return Buffer.from(html, 'utf8');
    }
  },
  {
    name: 'manifest.webmanifest',
    build() {
      const raw = readFileSync(resolve(root, 'src/manifest.webmanifest.template.json'), 'utf8');
      JSON.parse(raw);
      return Buffer.from(raw, 'utf8');
    }
  },
  {
    name: 'sw.js',
    build() {
      let sw = readFileSync(resolve(root, 'src/sw.template.js'), 'utf8');
      const versionToken = '__APP_VERSION__';
      if (sw.split(versionToken).length !== 2) throw new Error(`Expected exactly one ${versionToken} in sw.template.js`);
      sw = sw.replace(versionToken, appVersion);
      return Buffer.from(sw, 'utf8');
    }
  }
];

let failed = false;
for (const artifact of outputs) {
  const built = artifact.build();
  const dest = resolve(root, artifact.name);
  if (checkMode) {
    if (!readFileSync(dest).equals(built)) {
      console.error(`${artifact.name} is out of date. Run npm run build.`);
      failed = true;
    }
  } else {
    writeFileSync(dest, built);
    console.log(`Built ${artifact.name} (${built.length} bytes).`);
    console.log(`SHA-256: ${createHash('sha256').update(built).digest('hex')}`);
  }
}

if (checkMode) {
  if (failed) process.exit(1);
  console.log('PASS: distribution is byte-identical to editable sources.');
}
