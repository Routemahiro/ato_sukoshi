const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {snackState,finishFlourish,createFlourishPicker}=require('../src/snack-core.js');
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

const FLOURISH={frame:'ghost-lick.webp',holdMs:1200,showMs:800,chance:.5};
const at=(ms,duration=10000)=>snackState(duration,duration-ms);

test('tongue branch shows only inside the finished hold window',()=>{
  const pick=createFlourishPicker(()=>0);
  for(const ms of [1990,5000,7334,8000,8500,9400,9999])assert.equal(finishFlourish(at(ms),FLOURISH,pick),false,String(ms));
  for(const ms of [8600,9300])assert.equal(finishFlourish(at(ms),FLOURISH,pick),true,String(ms));
  assert.equal(finishFlourish(at(8533),FLOURISH,pick),false);
  assert.equal(finishFlourish(at(8534),FLOURISH,pick),true);
  assert.equal(finishFlourish(at(9333),FLOURISH,pick),true);
  assert.equal(finishFlourish(at(9334),FLOURISH,pick),false);
});

test('no-tongue branch stays on the finished frame',()=>{
  const pick=createFlourishPicker(()=>.99);
  for(let ms=0;ms<10000;ms++)assert.equal(finishFlourish(at(ms),FLOURISH,pick),false,String(ms));
});

test('flourish roll is once per item and lazy',()=>{
  let calls=0;
  const pick=createFlourishPicker(()=>{calls++;return 0;});
  for(let ms=0;ms<20000;ms++)finishFlourish(at(ms,20000),FLOURISH,pick);
  assert.equal(calls,2);
  calls=0;
  const early=createFlourishPicker(()=>{calls++;return 0;});
  for(let ms=0;ms<8533;ms++)finishFlourish(at(ms),FLOURISH,early);
  assert.equal(calls,0);
  let n=0;
  const rng=()=>{n++;return n===1?0:.99;};
  const again=createFlourishPicker(rng);
  const later=createFlourishPicker(rng);
  const state=at(8600);
  assert.equal(finishFlourish(state,FLOURISH,again),true);
  assert.equal(finishFlourish(state,FLOURISH,again),true);
  assert.equal(finishFlourish(state,FLOURISH,later),false);
  assert.equal(n,2);
});

test('flourish skips complete phase and short final items',()=>{
  const pick=createFlourishPicker(()=>0);
  const done=snackState(10000,0);
  assert.equal(done.phase,'complete');
  assert.equal(finishFlourish(done,FLOURISH,pick),false);
  for(const duration of [11000,17400]){
    const last=Math.ceil(duration/10000)-1;
    for(let ms=0;ms<duration;ms++){
      const state=at(ms,duration);
      if(state.index!==last)continue;
      assert.equal(finishFlourish(state,FLOURISH,pick),false,duration+' '+ms);
    }
  }
  const duration=17500,last=Math.ceil(duration/10000)-1;
  let shown=false;
  for(let ms=0;ms<duration;ms++){
    const state=at(ms,duration);
    if(state.index===last&&finishFlourish(state,FLOURISH,pick))shown=true;
  }
  assert.equal(shown,true);
});

function characters(){
  const js=read('src/app.js');
  const start=js.indexOf('const CHARACTERS=Object.freeze({');
  const end=js.indexOf('\n  });',start);
  assert.ok(start>=0&&end>start);
  return vm.runInNewContext(js.slice(start+'const CHARACTERS='.length,end)+'\n  })');
}

test('ghost is registered with doughnut landing and a per-item flourish',()=>{
  const js=read('src/app.js'),html=read('index.html');
  const chars=characters();
  const g=chars.ghost;
  assert.equal(g.id,'ghost');
  assert.equal(g.label,'おばけさん');
  assert.equal(g.snack,'ドーナツ');
  assert.equal(g.snackIcon,'doughnut.svg');
  assert.equal(g.ready,'ghost-ready.webp');
  assert.equal(g.chew(3),'ghost-chew-3.webp');
  assert.equal(g.nextScene('sleep'),'ghost-next-sleep.webp');
  assert.deepEqual([...g.land],[.514,.509]);
  assert.equal(g.landSize,.40);
  assert.deepEqual({...g.flourish},{frame:'ghost-lick.webp',holdMs:1200,showMs:800,chance:.5});
  for(const alt of ['おもちゃを片付けるおばけさん','ごはんを食べるおばけさん','おふろに入るおばけさん','リュックを背負って出かけるおばけさん','歯みがきするおばけさん','おふとんで眠るおばけさん'])assert.ok(js.includes(alt),alt);
  assert.deepEqual(Object.keys(chars),['squirrel','elephant','mouse','ghost']);
  assert.ok(html.includes('aria-label="前のなかま"')&&html.includes('aria-label="次のなかま"'));
  assert.equal(html.includes('なかまを えらぶ'),false);
  assert.ok(html.includes('id="finish-flourish"'));
  assert.ok(js.includes('character().landSize||.182'));
  assert.ok(js.includes('character().land||[.846,.612]'));
});

test('other characters have no flourish and share snackState',()=>{
  const chars=characters();
  assert.deepEqual(Object.keys(chars).filter(id=>chars[id].flourish),['ghost']);
  assert.deepEqual(Object.keys(chars).filter(id=>chars[id].landSize!==undefined),['ghost']);
  const samples=[0,1990,5000,7334,8000,8534,8900,9333,9400,9999];
  for(const id of ['squirrel','elephant','mouse']){
    let calls=0;
    const spy=(index,chance)=>{calls++;return true;};
    for(const ms of samples){
      assert.equal(finishFlourish(at(ms),chars[id].flourish,spy),false,id+' '+ms);
    }
    for(let ms=0;ms<10000;ms+=1)assert.equal(finishFlourish(at(ms),chars[id].flourish,spy),false);
    assert.equal(calls,0,id);
  }
  for(const ms of samples){
    const base=snackState(10000,10000-ms);
    for(const id of ['squirrel','elephant','mouse','ghost'])assert.deepEqual(snackState(10000,10000-ms,id),base,id+' '+ms);
  }
  assert.equal(snackState(20000,1,'ghost').phase,snackState(20000,1,'squirrel').phase);
});
