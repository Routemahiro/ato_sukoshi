/* Pure time -> animation mapping. No animation interval is a clock. */
(function(root) {
  'use strict';
  const STEP = 10000;
  const PAGE_SIZE = 60;
  const CHEW_FRAME_COUNT = 9;
  const CHEW_FINAL_FRAME = CHEW_FRAME_COUNT - 1;
  const CHEW_SOUND_COUNT = 6;
  const CHEW_SEQUENCE = Object.freeze([0,1,2,3,4,5,6,7,8]);
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  function snackState(durationMs, remainingMs) {
    if (!Number.isFinite(durationMs) || durationMs<1000 || durationMs>3600000)
      throw new RangeError('Invalid duration');
    const total=Math.ceil(durationMs/STEP);
    const elapsed=durationMs-clamp(remainingMs,0,durationMs);
    const complete=elapsed>=durationMs;
    const eaten=complete?total:Math.floor(elapsed/STEP);
    const index=Math.min(eaten,total-1);
    const start=index*STEP;
    const end=Math.min(durationMs,start+STEP);
    const stepMs=Math.max(1,end-start);
    const localElapsed=clamp(elapsed-start,0,stepMs);
    const cycle=clamp(localElapsed/stepMs,0,1);
    const reachRatio=.2, chewRatio=.6;
    const chewStart=reachRatio, settleStart=reachRatio+chewRatio;
    let phase='waiting',frame=-1,transfer=0,chewBeat=-1,cycleProgress=cycle,subframe=-1;
    if (complete) {
      phase='complete';
      frame=CHEW_FINAL_FRAME;
      subframe=CHEW_SEQUENCE.length-1;
      chewBeat=CHEW_SOUND_COUNT-1;
      transfer=1;
    }
    else if (cycle < chewStart) {
      phase='reach';
      transfer=clamp(cycle/reachRatio,0,1);
    } else if (cycle < settleStart) {
      phase='chew';
      const chewProgress=clamp((cycle-chewStart)/chewRatio,0,1);
      subframe=Math.min(CHEW_SEQUENCE.length-1,Math.floor(chewProgress*CHEW_SEQUENCE.length));
      frame=CHEW_SEQUENCE[subframe];
      chewBeat=Math.min(CHEW_SOUND_COUNT-1,Math.floor(chewProgress*CHEW_SOUND_COUNT));
      transfer=1;
    } else {
      phase='settle';
      transfer=1;
      frame=CHEW_FINAL_FRAME;
      subframe=CHEW_SEQUENCE.length-1;
      chewBeat=CHEW_SOUND_COUNT-1;
    }
    const pageStart=Math.floor(index/PAGE_SIZE)*PAGE_SIZE;
    const pageCount=Math.min(PAGE_SIZE,total-pageStart);
    return {total,eaten,index,start,end,stepMs,localElapsed,cycleProgress,phase,frame,subframe,pageStart,pageCount,
      reserve:Math.max(0,total-pageStart-pageCount),
      transfer,
      chewBeat,
      remainingBiteMs:Math.max(0,end-elapsed),
      progress:clamp(remainingMs/durationMs,0,1)};
  }
  const api={snackState,STEP,PAGE_SIZE,CHEW_SEQUENCE,CHEW_FRAME_COUNT,CHEW_FINAL_FRAME,CHEW_SOUND_COUNT};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  else root.AtosukoshiSnacks=api;
})(typeof globalThis!=='undefined'?globalThis:this);
