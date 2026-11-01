const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { snackState } = require('../src/snack-core.js');

const root = path.resolve(__dirname, '..');

const FILE_SHA = Object.freeze({
  'owl-chew-0.webp': '35ec632c7ce706876e5dff2106585962304f00827099e887cb50ce7a71293337',
  'owl-chew-1.webp': 'efca65f397fc035f2ba8be9bb3dc78638e2da0d36da5514649115ae2f5342d98',
  'owl-chew-2.webp': '6750fa617d90590ce47e42ccb551e97de7d3ad9e93937784e3a206c52d7a1845',
  'owl-chew-3.webp': '490ec50221275c288603f448176ed84ce68192dd3c1d6ae9e5b6a6996770f6a3',
  'owl-chew-4.webp': '794671f9691030651918286af55dd41b140d06500c0e1da5a4582c57eb3d0efc',
  'owl-chew-5.webp': '028695242c18c8f9d94825ad54755374154fdc9abd2c52097f231459fe207495',
  'owl-chew-6.webp': '97a83cf7fb1c531e722af54fe77ffc5d812e8db0780eb9d348d4aeb36445442f',
  'owl-chew-7.webp': '7c4550cc2e6606e2e8489c8c86ed8a8912cdf1ae190aa20d36bd1b56804325ce',
  'owl-chew-8.webp': '334cfda230eb368cb8cf1dfbfc35c01e65d05e73e6128010ce8d0c493ef915c4',
  'owl-ready.webp': '334cfda230eb368cb8cf1dfbfc35c01e65d05e73e6128010ce8d0c493ef915c4',
  'chestnut.svg': '58992f3a11889c2d0e9c381865c66a016b8ad9e1733f9948a59187ebcf13a00f',
  'owl-next-bath.webp': '2f220d6b74c09087fcf9621bbf644d7d375814c3b814d3157af991b5d0cc3e1c',
  'owl-next-brush.webp': '0e7d1d95a3bbd162756d52739506a399765412650abea7caae051f4084a744cb',
  'owl-next-meal.webp': '2c0d90399dfae7a1b62c39a920341a6824110f075bbf8327a1aa554aa0b01cb7',
  'owl-next-out.webp': 'feddfc048e1efbcfca7e7717f8993360c78eab095bdfb0f8b8d58877517f81aa',
  'owl-next-sleep.webp': '3de7e54d12f19e183b14c19cb4ea3e424abdfb5421deac9c57b5525cffca330a',
  'owl-next-tidy.webp': '0a0f1a4226aae8c74b0c87ceb649c84a2cdb927619b53400aa0109f8ddac4955',
});

function assetPath(name) {
  const dir = name.startsWith('owl-next-') ? 'ato-sukoshi-assets/owl/next-gen' : 'ato-sukoshi-assets/owl/upload';
  return path.join(root, dir, name);
}

test('owl data URLs match the upload and next-gen files', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/assets.js'), 'utf8'), sandbox, { timeout: 2000 });
  const a = sandbox.window.TimerAssets;
  for (const [name, sha] of Object.entries(FILE_SHA)) {
    const bytes = fs.readFileSync(assetPath(name));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha, name);
    const url = a[name];
    assert.ok(url, name);
    assert.deepEqual(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'), bytes, name);
  }
  const chew = Array.from({ length: 9 }, (_, i) => a['owl-chew-' + i + '.webp']);
  assert.equal(new Set(chew).size, 9);
  assert.equal(a['owl-chew-8.webp'], a['owl-ready.webp']);
});

function characters() {
  const js = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  const start = js.indexOf('const CHARACTERS=Object.freeze({');
  const end = js.indexOf('\n  });', start);
  return vm.runInNewContext(js.slice(start + 'const CHARACTERS='.length, end) + '\n  })');
}

test('owl is registered with chestnut snack and shared chew timing', () => {
  const chars = characters();
  const o = chars.owl;
  assert.equal(o.id, 'owl');
  assert.equal(o.label, 'ミミズクさん');
  assert.equal(o.snack, '栗');
  assert.equal(o.snackIcon, 'chestnut.svg');
  assert.equal(o.ready, 'owl-ready.webp');
  assert.equal(o.chew(3), 'owl-chew-3.webp');
  assert.equal(o.nextScene('sleep'), 'owl-next-sleep.webp');
  assert.equal(o.flourish, undefined);
  assert.equal(o.land, undefined);
  for (const ms of [2000, 3500, 7999, 8000]) {
    assert.deepEqual(snackState(10000, 10000 - ms, 'owl'), snackState(10000, 10000 - ms, 'squirrel'), 'ms ' + ms);
  }
});
