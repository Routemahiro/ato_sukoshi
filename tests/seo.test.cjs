const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const CANONICAL = 'https://geneshokai.com/ato-sukoshi/';
const GSC_FILE = 'googlec3eaef4e4d6e686f.html';
const GSC_SHA256 = 'c7c2dc2c3190a944774f2752a66b5029fff487175d4d9b4594254842482acc27';
const GSC_BODY = Buffer.from('google-site-verification: googlec3eaef4e4d6e686f.html', 'ascii');

function read(rel) {
  return fs.readFileSync(path.join(root, rel));
}

function pngInfo(rel) {
  const buf = read(rel);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', rel);
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR', rel);
  return {
    bytes: buf.length,
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25]
  };
}

function icoEntries(rel) {
  const buf = read(rel);
  assert.equal(buf.readUInt16LE(0), 0, rel);
  assert.equal(buf.readUInt16LE(2), 1, rel);
  const count = buf.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 16;
    const width = buf[at] || 256;
    const height = buf[at + 1] || 256;
    const nbytes = buf.readUInt32LE(at + 8);
    const offset = buf.readUInt32LE(at + 12);
    const blob = buf.subarray(offset, offset + nbytes);
    assert.equal(blob.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', rel);
    assert.equal(blob.subarray(12, 16).toString('ascii'), 'IHDR');
    entries.push({
      width,
      height,
      pngWidth: blob.readUInt32BE(16),
      pngHeight: blob.readUInt32BE(20)
    });
  }
  return entries;
}

test('head has one absolute canonical URL', () => {
  for (const rel of ['src/index.template.html', 'index.html']) {
    const html = read(rel).toString('utf8');
    const tags = html.match(/<link\b[^>]*rel="canonical"[^>]*>/g) || [];
    assert.equal(tags.length, 1, rel);
    assert.equal(tags[0], `<link rel="canonical" href="${CANONICAL}">`);
    assert.equal(html.includes('rel="canonical"'), true);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1, rel);
  }
});

test('icon links use relative URLs', () => {
  const html = read('src/index.template.html').toString('utf8');
  assert.match(html, /<link rel="icon" type="image\/png" sizes="96x96" href="favicon-96\.png">/);
  assert.match(html, /<link rel="apple-touch-icon" href="apple-touch-icon\.png">/);
  assert.match(html, /<link rel="icon" type="image\/x-icon" href="favicon\.ico" sizes="16x16 32x32">/);
  assert.equal(html.includes('https://geneshokai.com/ato-sukoshi/favicon'), false);
  const built = read('index.html').toString('utf8');
  assert.ok(built.includes('href="favicon-96.png"'));
  assert.ok(built.includes('href="apple-touch-icon.png"'));
  assert.ok(built.includes('href="favicon.ico"'));
});

test('visible title, description, and h1 stay put', () => {
  const html = read('src/index.template.html').toString('utf8');
  assert.ok(html.includes('<title>あとすこし — おしまいが見えるタイマー</title>'));
  assert.ok(html.includes('<meta name="description" content="子どもの「あとすこし」を、減っていくどんぐりで見える形に。終わりと次の行動をいっしょに確かめる、登録不要のやさしいWebタイマー。">'));
  assert.ok(html.includes('<h1 class="brand-name">あとすこし</h1>'));
  assert.ok(html.includes('株式会社LITALICO'));
});

test('sitemap lists only the canonical URL', () => {
  const file = path.join(root, 'public/sitemap.xml');
  const parsed = JSON.parse(execFileSync('python3', ['-c', `
import json, sys, xml.etree.ElementTree as ET
path = sys.argv[1]
tree = ET.parse(path)
root = tree.getroot()
ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
urls = []
for url in root.findall("sm:url", ns):
    urls.append({
        "loc": (url.find("sm:loc", ns).text or ""),
        "lastmod": (url.find("sm:lastmod", ns).text or ""),
    })
print(json.dumps({"tag": root.tag, "urls": urls}))
`, file], {encoding: 'utf8'}));
  assert.equal(parsed.tag, '{http://www.sitemaps.org/schemas/sitemap/0.9}urlset');
  assert.equal(parsed.urls.length, 1);
  assert.equal(parsed.urls[0].loc, CANONICAL);
  assert.match(parsed.urls[0].lastmod, /^\d{4}-\d{2}-\d{2}$/);
  const raw = read('public/sitemap.xml').toString('utf8');
  assert.equal((raw.match(/<loc>/g) || []).length, 1);
  assert.equal(raw.includes('<loc>' + CANONICAL + '</loc>'), true);
  assert.equal(raw.includes('googlec3eaef4e4d6e686f'), false);
});

test('google site verification file is the exact 53 bytes and is not a sitemap URL', async () => {
  const file = read('public/' + GSC_FILE);
  assert.equal(file.length, 53);
  assert.deepEqual(file, GSC_BODY);
  assert.equal(file.includes(0x0a), false);
  assert.equal(file.includes(0x0d), false);
  assert.equal(file[0], 0x67);
  assert.equal(crypto.createHash('sha256').update(file).digest('hex'), GSC_SHA256);
  const sitemap = read('public/sitemap.xml').toString('utf8');
  assert.equal(sitemap.includes(GSC_FILE), false);
  assert.equal(sitemap.includes('google-site-verification'), false);
  const { shippedFiles } = await import('../scripts/shipped-files.mjs');
  assert.deepEqual(
    shippedFiles.find(entry => entry.name === GSC_FILE),
    { source: 'public/' + GSC_FILE, name: GSC_FILE }
  );
  const attrs = read('.gitattributes').toString('utf8');
  assert.match(attrs, /^public\/googlec3eaef4e4d6e686f\.html -text$/m);
});

test('deploy staging copies the shipped registry into deploy/', async () => {
  const { shippedFiles } = await import('../scripts/shipped-files.mjs');
  const names = shippedFiles.map(file => file.name);
  assert.equal(new Set(names).size, names.length);
  execFileSync(process.execPath, ['scripts/stage-deploy.mjs'], { cwd: root, encoding: 'utf8' });
  assert.deepEqual(fs.readdirSync(path.join(root, 'deploy')).sort(), [...names].sort());
  for (const file of shippedFiles) {
    const staged = read(path.join('deploy', file.name));
    assert.equal(staged.equals(read(file.source)), true, file.name);
    if (file.name === GSC_FILE) {
      assert.equal(staged.length, 53);
      assert.deepEqual(staged, GSC_BODY);
      assert.equal(crypto.createHash('sha256').update(staged).digest('hex'), GSC_SHA256);
    }
  }
  const yml = read('.github/workflows/deploy.yml').toString('utf8');
  assert.equal((yml.match(/node scripts\/stage-deploy\.mjs/g) || []).length, 1);
  assert.equal((yml.match(/local-dir: deploy\//g) || []).length, 3);
  assert.equal(yml.includes('workflow_dispatch'), true);
  assert.equal(yml.includes('dangerous-clean-slate'), false);
  assert.equal(yml.includes('cp index.html deploy/'), false);
});

test('favicon PNG, apple touch icon, and favicon.ico have the expected sizes', () => {
  const png = pngInfo('public/favicon-96.png');
  assert.equal(png.width, 96);
  assert.equal(png.height, 96);
  assert.equal(png.width % 48, 0);
  assert.equal(png.bitDepth, 8);
  assert.equal(png.colorType, 6);
  assert.ok(png.bytes < 20000);

  const apple = pngInfo('public/apple-touch-icon.png');
  assert.equal(apple.width, 180);
  assert.equal(apple.height, 180);
  assert.equal(apple.colorType, 2);
  assert.ok(apple.bytes < 20000);

  const entries = icoEntries('public/favicon.ico');
  assert.deepEqual(entries.map(e => [e.width, e.height, e.pngWidth, e.pngHeight]), [
    [16, 16, 16, 16],
    [32, 32, 32, 32]
  ]);
  assert.ok(read('public/favicon.ico').length < 20000);
});
