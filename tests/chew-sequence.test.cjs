const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {snackState,CHEW_SOUND_COUNT}=require('../src/snack-core.js');

function at(ms,character,duration=10000){return snackState(duration,duration-ms,character);}

test('elephant chew uses the squirrel 9-step timeline',()=>{
  const slot=6000/9;
  for(let i=0;i<9;i++){
    const mid=2000+(i+.5)*slot;
    const elephant=at(mid,'elephant');
    const squirrel=at(mid);
    assert.equal(elephant.phase,'chew','slot '+i);
    assert.equal(elephant.frame,i,'slot '+i);
    assert.equal(elephant.subframe,i,'slot '+i);
    assert.deepEqual(elephant,squirrel,'slot '+i);
  }
  assert.equal(at(2000,'elephant').frame,0);
  assert.equal(at(2667,'elephant').frame,1);
  assert.equal(at(3500,'elephant').frame,2);
  assert.equal(at(7999,'elephant').phase,'chew');
  assert.equal(at(7999,'elephant').frame,8);
  const settle=at(8000,'elephant');
  assert.equal(settle.phase,'settle');
  assert.equal(settle.frame,8);
  assert.deepEqual(settle,at(8000));
  const done=snackState(10000,0,'elephant');
  assert.equal(done.phase,'complete');
  assert.equal(done.frame,8);
  assert.deepEqual(done,snackState(10000,0));
});

test('elephant frame holds for a full squirrel slot',()=>{
  const slot=6000/9;
  for(let i=0;i<9;i++){
    const start=Math.ceil(2000+i*slot);
    const end=Math.floor(2000+(i+1)*slot)-1;
    assert.equal(at(start,'elephant').frame,i,'start '+start);
    assert.equal(at(end,'elephant').frame,i,'end '+end);
  }
});

test('both characters keep six munch beats in the chew window',()=>{
  for(const id of [undefined,'squirrel','elephant']){
    const beats=[];
    for(let ms=2000;ms<8000;ms+=50) beats.push(at(ms,id).chewBeat);
    assert.deepEqual([...new Set(beats)],[0,1,2,3,4,5]);
    assert.equal(CHEW_SOUND_COUNT,6);
    assert.equal(at(2000,id).chewBeat,0);
    assert.equal(at(7999,id).chewBeat,5);
  }
});

test('squirrel snackState matches the pre-change pin',()=>{
  const durations=[1000,10000,11000,20000,60000,3599999,3600000];
  const samples=[];
  for(const d of durations){
    const points=new Set([0,1,d-1,d,d+1,-1,d+5]);
    const limit=Math.min(d,30000);
    for(let t=0;t<=limit;t+=137) points.add(t);
    for(const edge of [999,1000,1999,2000,2333,2334,2666,2667,3499,3500,5999,6000,7999,8000,8001,9999,10000]){
      points.add(edge);
      points.add(edge+10000);
      points.add(edge+20000);
    }
    for(const remaining of [...points].sort((a,b)=>a-b)){
      let value;
      try{value=snackState(d,remaining);}
      catch(e){value={error:e.name,message:e.message};}
      assert.deepEqual(snackState(d,remaining,'squirrel'),value);
      if(!value.error) assert.deepEqual(snackState(d,remaining,'elephant'),value);
      samples.push({d,remaining,value});
    }
  }
  const hash=crypto.createHash('sha256').update(JSON.stringify(samples)).digest('hex');
  assert.equal(hash,'10f9ed4e83f9fb1a06d9ddb07b8c53a0e0b5763fbc68c0cf4dcde364a267c086');
});
