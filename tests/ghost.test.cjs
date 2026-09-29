const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');

const EXPECTED={
  'ghost-chew-0.webp':'70ec396694c5dfa3291d1e08647ff2042e5432c0cb183e7f811312cbcfdf9ffa',
  'ghost-chew-1.webp':'b2367209a4919b4b6110ef94c4c274027d27f3df14a6f877da7f8e5a762b448f',
  'ghost-chew-2.webp':'9bac38ff9ee958d8f16c0171ceb698b7da5887df61b5eadc5fd4120b1ada5869',
  'ghost-chew-3.webp':'a9edee60cbe146455e0c4f6c316100c505802c29b315b6e4b158ef69537cc51b',
  'ghost-chew-4.webp':'2608ccb742a7bcc4c2c666d64ec1b6d60352790a53a3f253991285c2bc852992',
  'ghost-chew-5.webp':'3da27b739a4bdb10995884e84a2058aa4206ce12801abaf2e6ffdf8d124057be',
  'ghost-chew-6.webp':'9666e25b4db2742d07d95d8701018ce7604c28d9067e95a606211b3a14c1bfc8',
  'ghost-chew-7.webp':'e3519354c0268ab56f0ef74a94eeecdbc72a55e58dbdec3b10864a2a9695319f',
  'ghost-chew-8.webp':'59851f5ef3e656da0617f1436d727423a3d6bedbc571a90389d7f83d5db1bea0',
  'ghost-ready.webp':'959d71490a5ce81e02cb28dc1d5105c7558ae15108bba0706ff0a544fd58ed96',
  'ghost-lick.webp':'eda95530689ee1e26ad299f83c4e03536363231ad4d8d21dc7c25b12ac4fe717',
  'doughnut.svg':'f9f0c974b0247089b08964ba33dd53c050497e563dde3554be34ad7a6f044f4b',
  'ghost-next-bath.webp':'34636b46e5413ac75cc89e040adeaddd85ce8838b9e8a283de268b0f27eecaaa',
  'ghost-next-brush.webp':'7b2f9bcfe273a3a287464e8a4ea8ef225704fdfbfcc3810261e630876a995874',
  'ghost-next-meal.webp':'839019daf85af3012f64dbc1b494c91ed979e141264156495d77f0074c7f284f',
  'ghost-next-out.webp':'a4638114b13b8efcc404fd409650b23d5b33f69b8e80cdebcdd5968c30d9d1fd',
  'ghost-next-sleep.webp':'c8b85d417a7b8c657ca7501526de3210127c136f93046d0dd307b2f16a03e9c6',
  'ghost-next-tidy.webp':'70677379e19c10f67b9e1177a1fcb56fd19c365d45180252be5a59e4a1de458a'
};

function fileFor(name){
  const dir=name.startsWith('ghost-next-')?'ato-sukoshi-assets/ghost/next-gen':'ato-sukoshi-assets/ghost/upload';
  return fs.readFileSync(path.join(root,dir,name));
}

test('ghost data URLs match the upload and next-gen files',()=>{
  const s={window:{}};
  vm.runInNewContext(read('src/assets.js'),s,{timeout:2000});
  const a=s.window.TimerAssets;
  function bytes(name){
    const url=a[name];
    assert.ok(url,name);
    const buf=Buffer.from(url.slice(url.indexOf(',')+1),'base64');
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),EXPECTED[name],name);
    return buf;
  }
  for(const name of Object.keys(EXPECTED))assert.deepEqual(bytes(name),fileFor(name),name);
  const chew=Array.from({length:9},(_,i)=>a['ghost-chew-'+i+'.webp']);
  assert.equal(new Set(chew).size,9);
  assert.notEqual(a['ghost-lick.webp'],a['ghost-chew-8.webp']);
  assert.notEqual(a['ghost-ready.webp'],a['ghost-chew-8.webp']);
});
