const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {snackState}=require('../src/snack-core.js');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');

const EXPECTED={
  'chestnut.svg':'8ba087723bba6aeba989a83d58836cb8a926ca937932048ce1747fd96e676ab2',
  'owl-ready.webp':'66da660d472a501ca0720c9c8908eca51d029c6ba12fddcf8e942804e1df50e5',
  'owl-chew-0.webp':'b55006552db643fc9b9bd2a7cd26868d10c181aab498ea48e53c9c1528778d40',
  'owl-chew-1.webp':'0bd740cb1a757f76ef819c5b66874b8bdf81298707f060bd2e584e15c2dedb29',
  'owl-chew-2.webp':'76b077931c684b607ad67a54f254beaf29b9154fd7690403d383b27edcd6f3a2',
  'owl-chew-3.webp':'2ddf025005b7e6c69db5c0978ff2a0edc597d34c0522414fe3c1f581559e4665',
  'owl-chew-4.webp':'d82c78288741b9b70beb15894ea3e4b96e2d6f38aa92c336000063b165538f5c',
  'owl-chew-5.webp':'b698df636ae9d58f1c938bbbab2541ae2361efe01f2c5376013a94ab332e299f',
  'owl-chew-6.webp':'2ae1a95a9eb4b7df8323a209c681c04b957896790b58c5611c58b46a02932d51',
  'owl-chew-7.webp':'6bd99487f96896626f21c116df3703874b08fe7520f55467f57706f49c41e30a',
  'owl-chew-8.webp':'66da660d472a501ca0720c9c8908eca51d029c6ba12fddcf8e942804e1df50e5',
  'owl-next-tidy.webp':'862b934020dd8275c018e4d09afbf326a4f174cadbb9837a19b53e7bf3b23692',
  'owl-next-meal.webp':'84c4c1988290f287756c0ddcaad10ab76f2d347e20bf957825159aac98b8aafe',
  'owl-next-bath.webp':'1aea9ff0d9683fccc88c37f0d4a9faf8c100c55705b3c75088a35df62052ac01',
  'owl-next-out.webp':'82597e1d4548386625cafb0e2fdafe4d34b043ee7f4dbeb3eccb52ced87770c0',
  'owl-next-brush.webp':'53a24e7585ebbd7f8904f6fa9b7e08e135c7c6cc90dfe7b3f9d5fc9a480507df',
  'owl-next-sleep.webp':'e619c45e8f59084b30a540973dd87b4d15c30b2eb79b6d247a7fadbcf74f43f6'
};

function fileFor(name){
  const dir=name.startsWith('owl-next-')?'ato-sukoshi-assets/owl/next-gen':'ato-sukoshi-assets/owl/upload';
  return fs.readFileSync(path.join(root,dir,name));
}

test('owl data URLs match the upload and next-gen files',()=>{
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
  const chew=Array.from({length:9},(_,i)=>a['owl-chew-'+i+'.webp']);
  assert.equal(new Set(chew).size,9);
  assert.equal(a['owl-chew-8.webp'],a['owl-ready.webp']);
});

function characters(){
  const js=read('src/app.js');
  const start=js.indexOf('const CHARACTERS=Object.freeze({');
  const end=js.indexOf('\n  });',start);
  assert.ok(start>=0&&end>start);
  return vm.runInNewContext(js.slice(start+'const CHARACTERS='.length,end)+'\n  })');
}

test('owl is registered with chestnut snack icon',()=>{
  const chars=characters();
  const o=chars.owl;
  assert.equal(o.id,'owl');
  assert.equal(o.label,'ミミズクさん');
  assert.equal(o.snack,'栗');
  assert.equal(o.snackIcon,'chestnut.svg');
  assert.equal(o.ready,'owl-ready.webp');
  assert.equal(o.chew(3),'owl-chew-3.webp');
  assert.equal(o.nextScene('sleep'),'owl-next-sleep.webp');
  assert.equal(o.flourish,undefined);
  assert.deepEqual(Object.keys(chars),['squirrel','elephant','mouse','ghost','owl']);
});

test('owl shares the shared chew timeline',()=>{
  for(const ms of [2000,2667,3500,7999,8000]){
    assert.deepEqual(snackState(10000,10000-ms,'owl'),snackState(10000,10000-ms));
  }
});
