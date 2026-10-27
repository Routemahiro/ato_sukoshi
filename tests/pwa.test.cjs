const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { execFileSync, spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel));
}

function pngInfo(rel) {
  const buf = read(rel);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', rel);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20)
  };
}

test('manifest and service worker artifacts ship with deploy staging', async () => {
  const { shippedFiles } = await import('../scripts/shipped-files.mjs');
  const names = shippedFiles.map((file) => file.name);
  for (const required of [
    'manifest.webmanifest',
    'sw.js',
    'icon-192.png',
    'icon-512.png',
    'icon-512-maskable.png'
  ]) {
    assert.ok(names.includes(required), required);
  }
  execFileSync(process.execPath, ['scripts/stage-deploy.mjs'], { cwd: root, encoding: 'utf8' });
  for (const required of ['manifest.webmanifest', 'sw.js']) {
    assert.ok(fs.existsSync(path.join(root, 'deploy', required)), required);
  }
});

test('manifest is valid JSON with standalone scope and Japanese name', () => {
  const manifest = JSON.parse(read('manifest.webmanifest').toString('utf8'));
  assert.equal(manifest.name, 'あとすこし');
  assert.equal(manifest.short_name, 'あとすこし');
  assert.equal(manifest.lang, 'ja');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.theme_color, '#faf8f1');
  assert.equal(manifest.background_color, '#faf8f1');
  const purposes = manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`);
  assert.ok(purposes.includes('192x192:any'));
  assert.ok(purposes.includes('512x512:any'));
  assert.ok(purposes.includes('512x512:maskable'));
});

test('template links manifest, PWA icons, and registers the service worker', () => {
  const html = read('src/index.template.html').toString('utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /sizes="192x192" href="icon-192\.png"/);
  assert.match(html, /serviceWorker\.register\('sw\.js'/);
  assert.match(html, /scope: '\.\/'/);
  const built = read('index.html').toString('utf8');
  assert.ok(built.includes('rel="manifest"'));
  assert.ok(built.includes("serviceWorker.register('sw.js'"));
});

test('service worker cache name matches package version', async () => {
  const pkg = JSON.parse(read('package.json').toString('utf8'));
  const sw = read('sw.js').toString('utf8');
  assert.ok(sw.includes(`const CACHE_VERSION = '${pkg.version}'`));
  assert.ok(sw.includes(`const CACHE_NAME = 'ato-sukoshi-' + CACHE_VERSION`));
  assert.ok(sw.includes("'www.googletagmanager.com'"));
  assert.ok(sw.includes('if (ANALYTICS_HOSTS.includes(url.hostname)) return'));
});

test('PWA icon PNG sizes', () => {
  assert.deepEqual(pngInfo('public/icon-192.png'), { width: 192, height: 192 });
  assert.deepEqual(pngInfo('public/icon-512.png'), { width: 512, height: 512 });
  assert.deepEqual(pngInfo('public/icon-512-maskable.png'), { width: 512, height: 512 });
});

test('headless browser: manifest, service worker, offline shell', { timeout: 180_000 }, async () => {
  execFileSync(process.execPath, ['scripts/build.mjs', '--check'], { cwd: root });
  const deployDir = path.join(root, 'deploy');
  execFileSync(process.execPath, ['scripts/stage-deploy.mjs'], { cwd: root });

  const port = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      resolve(probe.address().port);
      probe.close();
    });
  });
  const baseUrl = `http://127.0.0.1:${port}/`;
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: deployDir,
    stdio: 'ignore'
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('static server did not start')), 10_000);
    server.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    server.once('spawn', () => {
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 300);
    });
  });

  const pwPrefix = path.join(root, '.puppeteer-core-test');
  const puppeteerModule = path.join(pwPrefix, 'node_modules', 'puppeteer-core');
  const scriptPath = path.join(root, 'tests', 'pwa-headless-run.cjs');
  fs.writeFileSync(scriptPath, `
const puppeteer = require(${JSON.stringify(puppeteerModule)});

(async () => {
  const baseUrl = ${JSON.stringify(baseUrl)};
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg && reg.active);
    }, { timeout: 15_000 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]').href;
      return fetch(href).then((resp) => resp.json());
    });
    if (manifest.display !== 'standalone') throw new Error('manifest display');
    const reg = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready;
      return { scope: ready.scope, scriptURL: ready.active?.scriptURL || '' };
    });
    if (!reg.scriptURL.endsWith('/sw.js')) throw new Error('sw register: ' + reg.scriptURL);
    await page.setOfflineMode(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    const title = await page.title();
    if (!title.includes('あとすこし')) throw new Error('offline title: ' + title);
    console.log('PWA_HEADLESS_OK');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
`);

  try {
    execFileSync('npm', ['install', 'puppeteer-core@24.2.0', '--prefix', pwPrefix, '--no-package-lock', '--no-save'], {
      cwd: root,
      stdio: 'pipe',
      timeout: 90_000
    });
    execFileSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: 'utf8',
      timeout: 150_000
    });
  } finally {
    fs.rmSync(pwPrefix, { recursive: true, force: true });
    server.kill('SIGTERM');
    fs.rmSync(scriptPath, { force: true });
  }
});
