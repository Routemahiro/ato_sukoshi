/* Atosukoshi v7. Dependency-free, local-only UI. Existing generated artwork.
 * Countdowns use absolute deadlines. Drawing and sound are effects, never clocks.
 */
(() => {
  'use strict';
  const {Countdown,formatTime}=window.Atosukoshi;
  const {snackState,CHEW_FRAME_COUNT,createFlourishPicker,finishFlourish}=window.AtosukoshiSnacks;
  const {sanitizePreferences,applyVisiblePresets,cycleCharacter,PREF_KEY,LEGACY_PREF_KEYS}=window.AtosukoshiStage;
  const A=window.TimerAssets;
  const $=id=>document.getElementById(id);
  const SESSION='atosukoshi.timer.v1';
  const CURRENT={play:'あそび',video:'どうが',book:'えほん',meal:'ごはん'};
  const NEXT={tidy:'おかたづけ',meal:'ごはん',bath:'おふろ',out:'おでかけ',brush:'はみがき',sleep:'ねんね'};
  const SCENE_ALT={
    squirrel:{tidy:'おもちゃを片付けるりすさん',meal:'ごはんを食べるりすさん',bath:'おふろに入るりすさん',out:'リュックを背負って出かけるりすさん',brush:'歯みがきするりすさん',sleep:'おふとんで眠るりすさん'},
    elephant:{tidy:'おもちゃを片付けるぞうさん',meal:'ごはんを食べるぞうさん',bath:'おふろに入るぞうさん',out:'リュックを背負って出かけるぞうさん',brush:'歯みがきするぞうさん',sleep:'おふとんで眠るぞうさん'},
    mouse:{tidy:'おもちゃを片付けるねずみさん',meal:'ごはんを食べるねずみさん',bath:'おふろに入るねずみさん',out:'リュックを背負って出かけるねずみさん',brush:'歯みがきするねずみさん',sleep:'おふとんで眠るねずみさん'},
    ghost:{tidy:'おもちゃを片付けるおばけさん',meal:'ごはんを食べるおばけさん',bath:'おふろに入るおばけさん',out:'リュックを背負って出かけるおばけさん',brush:'歯みがきするおばけさん',sleep:'おふとんで眠るおばけさん'}
  };
  const CHARACTERS=Object.freeze({
    squirrel:{id:'squirrel',label:'りすさん',snack:'どんぐり',ready:'squirrel-ready.webp',chew:i=>'chew-'+i+'.webp',snackIcon:'acorn.svg',nextScene:k=>'next-'+k+'.webp'},
    elephant:{id:'elephant',label:'ぞうさん',snack:'りんご',ready:'elephant-ready.webp',chew:i=>'elephant-chew-'+i+'.webp',snackIcon:'apple.svg',nextScene:k=>'elephant-next-'+k+'.webp'},
    mouse:{id:'mouse',label:'ねずみさん',snack:'ビスケット',ready:'mouse-ready.webp',chew:i=>'mouse-chew-'+i+'.webp',snackIcon:'biscuit.svg',nextScene:k=>'mouse-next-'+k+'.webp',land:[.668,.542]},
    ghost:{id:'ghost',label:'おばけさん',snack:'ドーナツ',ready:'ghost-ready.webp',chew:i=>'ghost-chew-'+i+'.webp',snackIcon:'doughnut.svg',nextScene:k=>'ghost-next-'+k+'.webp',land:[.514,.509],landSize:.40,flourish:{frame:'ghost-lick.webp',holdMs:1200,showMs:800,chance:.5}}
  });
  const own=(obj,key)=>typeof key==='string' && Object.prototype.hasOwnProperty.call(obj,key);
  const timer=new Countdown();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let prefs=sanitizePreferences(null),sessionChoices=null,demo=false;
  let lastMode='',lastSeconds=-1,gridKey='',snackVisualKey='',sceneKey='';
  let acornNodes=[],raf=0,toastTimer=0,storageWarned=false;
  let audio=null,munchBuffer=null,defaultMunchBuffer=null,audioLoad=null,customMunch=false,fileVersion=0;
  const notes=new Set(),munchNodes=new Set();
  let lastSoundIndex=-1,lastSoundPhase='',lastMunchCue='',wake=null,wakePending=false;
  let gateTimer=null,gateStarted=false;
  let flourishPick=createFlourishPicker();

  function toast(text) {
    $('toast').textContent=text; $('toast').hidden=false; clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{$('toast').hidden=true;},4300);
  }
  function readStorage(kind,key) {try {return JSON.parse(window[kind].getItem(key)||'null');}catch{return null;}}
  function saveStorage(kind,key,value) {
    try {if(value===null) window[kind].removeItem(key); else window[kind].setItem(key,JSON.stringify(value));return true;}
    catch {if(!storageWarned){storageWarned=true;toast('設定を保存できません。この画面を開いたままなら使えます。');}return false;}
  }
  function savePrefs(){saveStorage('localStorage',PREF_KEY,prefs);}
  function saveSession(){saveStorage('sessionStorage',SESSION,timer.status==='idle'?null:{timer:timer.snapshot(),choices:sessionChoices,demo});}
  function choices(){return timer.status==='idle'?prefs:(sessionChoices||prefs);}
  function announce(text){$('announcement').textContent=text;}
  function timeWords(ms){const n=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(n/60),s=n%60;return(m?m+'分':'')+(s?s+'秒':'')||'0秒';}
  function holdRequired(){return timer.status==='running'||timer.status==='paused';}
  function audioRunning(){return audio && audio.state==='running';}

  function reflectDurationChoices(){
    const enabled=new Set(prefs.visiblePresets);
    document.querySelectorAll('#duration-choices [data-seconds]').forEach(b=>{
      const seconds=+b.dataset.seconds;
      b.setAttribute('aria-pressed',String(seconds===prefs.seconds));
      b.setAttribute('aria-disabled',String(!enabled.has(seconds)));
    });
    document.querySelectorAll('[data-visible-preset]').forEach(c=>{
      c.checked=enabled.has(+c.dataset.visiblePreset);
    });
  }

  function character(){return CHARACTERS[prefs.character]||CHARACTERS.squirrel;}
  function applyCharacterAssets(){
    const c=character();
    $('brand-icon').src=A[c.snackIcon];
    $('squirrel-ready').src=A[c.ready];
    for(let i=0;i<CHEW_FRAME_COUNT;i++)$('chew-'+i).src=A[c.chew(i)];
    $('flying-acorn').src=A[c.snackIcon];
    if(c.flourish)$('finish-flourish').src=A[c.flourish.frame];
    else $('finish-flourish').removeAttribute('src');
    gridKey='';snackVisualKey='';
  }
  function reflectPrefs(){
    reflectDurationChoices();
    document.querySelectorAll('[data-next]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.next===prefs.next)));
    $('munch-on').checked=prefs.munch;
    $('show-digits').checked=prefs.digits;$('keep-awake').checked=prefs.awake;
    applyCharacterAssets();
    $('start-label').textContent=timeWords(prefs.seconds*1000)+'で はじめる';
    if(timer.status==='idle'){timer.reset(prefs.seconds*1000);gridKey='';}
    render(true);
  }

  function deviceStatus(){
    $('wake-status').textContent=timer.status!=='running'?'自動消灯の防止：停止中':!prefs.awake?'自動消灯の防止：切':wake&&!wake.released?'画面の自動消灯を防止中':'画面が消えないよう確認してください';
    $('audio-status').textContent=audioRunning()?'終了音：入 · 音量は端末で調整':'終了音：タップで有効にできます';
  }
  async function releaseWake(){const w=wake;wake=null;if(w&&!w.released){try{await w.release();}catch{}}deviceStatus();}
  async function requestWake(){
    if(wakePending || (wake&&!wake.released) || timer.status!=='running' || !prefs.awake || document.hidden) return;
    if(!navigator.wakeLock || !isSecureContext){deviceStatus();return;}
    wakePending=true;
    try{
      const candidate=await navigator.wakeLock.request('screen');
      if(timer.status!=='running'||document.hidden||!prefs.awake){await candidate.release();return;}
      wake=candidate;candidate.addEventListener('release',()=>{if(wake===candidate)wake=null;deviceStatus();});
    }catch{}finally{wakePending=false;deviceStatus();}
  }
  function stopSet(set){for(const node of set){try{node.stop();}catch{} }set.clear();}
  function stopSound(){stopSet(notes);stopSet(munchNodes);}
  function stopMunch(){stopSet(munchNodes);}
  function bytesFromDataURL(url){const binary=atob(url.split(',')[1]);return Uint8Array.from(binary,c=>c.charCodeAt(0)).buffer;}
  function loadDefaultAudio(){
    if(defaultMunchBuffer) return Promise.resolve(defaultMunchBuffer);
    if(!audioLoad) audioLoad=audio.decodeAudioData(bytesFromDataURL(A['munch.wav'])).then(buffer=>{
      defaultMunchBuffer=buffer;if(!customMunch)munchBuffer=buffer;return buffer;
    }).catch(()=>{audioLoad=null;return null;});
    return audioLoad;
  }
  async function unlockAudio(quiet=false){
    try{
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context) throw Error('unsupported');
      if(!audio||audio.state==='closed'){
        audio=new Context();audioLoad=null;defaultMunchBuffer=null;
        if(!customMunch)munchBuffer=null;
        audio.addEventListener('statechange',()=>{
          deviceStatus();
          if(timer.status==='running') $('audio-restore').hidden=audioRunning();
        });
      }
      // Called directly from click/key activation, before awaiting other work.
      await audio.resume();
      if(!audioRunning()) throw Error('suspended');
      $('audio-restore').hidden=true;deviceStatus();loadDefaultAudio();return true;
    }catch{
      deviceStatus();
      if(!quiet)toast('音を有効にできませんでした。画面でも終了をお知らせします。');
      return false;
    }
  }
  function chime(){
    if(!audioRunning()||document.hidden)return false;
    stopSound();
    [523.25,659.25,783.99].forEach((frequency,i)=>{
      const at=audio.currentTime+.025+i*.27,osc=audio.createOscillator(),gain=audio.createGain();
      osc.type='sine';osc.frequency.value=frequency;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.105,at+.025);gain.gain.exponentialRampToValueAtTime(.001,at+.67);
      osc.connect(gain);gain.connect(audio.destination);osc.start(at);osc.stop(at+.72);notes.add(osc);
      osc.onended=()=>{notes.delete(osc);osc.disconnect();gain.disconnect();};
    });
    window.dispatchEvent(new CustomEvent('atosukoshi:chime'));return true;
  }
  function playMunch(maxSeconds=2,index=-1){
    if(!audioRunning()||document.hidden||!munchBuffer)return false;
    stopMunch();
    const node=audio.createBufferSource(),gain=audio.createGain();
    node.buffer=munchBuffer;
    const duration=Math.min(munchBuffer.duration,Math.max(.025,maxSeconds)),now=audio.currentTime;
    gain.gain.setValueAtTime(.65,now);gain.gain.setValueAtTime(.65,now+Math.max(0,duration-.04));gain.gain.linearRampToValueAtTime(0,now+duration);
    node.connect(gain);gain.connect(audio.destination);node.start(now,0,duration);munchNodes.add(node);
    node.onended=()=>{munchNodes.delete(node);node.disconnect();gain.disconnect();};
    window.dispatchEvent(new CustomEvent('atosukoshi:munch',{detail:{index,custom:customMunch,duration}}));return true;
  }
  function suppressCurrentSound(){const s=snackState(timer.durationMs,timer.remaining());lastSoundIndex=s.index;lastSoundPhase=s.phase;lastMunchCue=s.index+':'+s.chewBeat;}

  function buildGrid(s){
    const key=timer.durationMs+':'+s.pageStart;
    if(gridKey===key)return;
    const cols=Math.min(9,Math.max(1,Math.ceil(Math.sqrt(s.pageCount*1.15))));
    const root=$('acorns');root.replaceChildren();root.style.setProperty('--columns',String(cols));root.style.setProperty('--acorn-width',Math.min(420,cols*58)+'px');
    acornNodes=Array.from({length:s.pageCount},(_,i)=>{
      const div=document.createElement('div');div.className='acorn';div.dataset.index=String(s.pageStart+i);
      const img=document.createElement('img');img.src=A[character().snackIcon];img.alt='';img.draggable=false;div.appendChild(img);root.appendChild(div);return div;
    });
    $('reserve-note').hidden=s.reserve===0;$('reserve-note').textContent='このあとに、あと '+s.reserve+'こ';
    gridKey=key;snackVisualKey='';
  }
  function setFrame(n,flourish=false){
    $('squirrel-ready').hidden=n>=0;
    for(let i=0;i<CHEW_FRAME_COUNT;i++)$('chew-'+i).hidden=flourish||i!==n;
    $('finish-flourish').hidden=!flourish;
  }
  function positionCarriedAcorn(s){
    const item=acornNodes[s.index-s.pageStart];if(!item)return;
    const src=item.getBoundingClientRect(),box=$('snack-theater').getBoundingClientRect(),sprite=$('squirrel-pose').getBoundingClientRect();
    const t=s.transfer,e=t*t*(3-2*t);
    const startX=src.left+src.width/2-box.left,startY=src.top+src.height/2-box.top;
    const land=character().land||[.846,.612];
    const endX=sprite.left+sprite.width*land[0]-box.left,endY=sprite.top+sprite.height*land[1]-box.top;
    const targetW=sprite.width*(character().landSize||.182),flyW=src.width+(targetW-src.width)*e,flyH=flyW*1.12;
    const x=startX+(endX-startX)*e,y=startY+(endY-startY)*e-Math.sin(Math.PI*t)*Math.min(30,box.width*.04);
    const fly=$('flying-acorn');fly.style.width=flyW+'px';fly.style.height=flyH+'px';
    fly.style.transform=`translate(${x-flyW/2}px,${y-flyH/2}px) rotate(${12*e}deg)`;
  }
  function applyChewPose(s,phase){
    const pose=$('squirrel-pose');
    if(reduced.matches || phase!=='chew' || s.subframe<0){ pose.style.transform=''; return; }
    const loop=s.subframe%6;
    const bob=[0,-3,-1,1,-2,0][loop];
    const rot=[0,-1.2,.2,1.1,-.5,.3][loop];
    const sx=[1,1.006,1.012,1.008,1.004,1][loop];
    const sy=[1,0.996,0.992,0.996,0.994,1][loop];
    pose.style.transform=`translateY(${bob}px) rotate(${rot}deg) scale(${sx}, ${sy})`;
  }
  function renderSnacks(){
    if(['finished','acknowledged'].includes(timer.status)){cancelAnimationFrame(raf);raf=0;return;}
    const s=snackState(timer.durationMs,timer.remaining());
    buildGrid(s);
    const moving=timer.status==='running'||timer.status==='paused';
    const phase=moving?s.phase:'waiting';
    const frame=moving&&s.frame>=0?s.frame:-1;
    const c=character(); const flourish=moving&&!reduced.matches&&!!c.flourish&&finishFlourish(s,c.flourish,flourishPick);
    const key=[s.pageStart,s.eaten,phase,frame,reduced.matches,flourish].join(':');
    if(key!==snackVisualKey){
      acornNodes.forEach((el,i)=>{
        const index=s.pageStart+i;
        el.classList.toggle('is-eaten',index<s.eaten);
        el.classList.toggle('is-carried',moving&&(phase==='reach'||phase==='chew'||phase==='settle')&&index===s.index&&!reduced.matches);
      });
      setFrame(reduced.matches?-1:frame,flourish);
      $('flying-acorn').hidden=phase!=='reach'||reduced.matches;
      $('snack-theater').dataset.phase=phase;$('snack-theater').dataset.eaten=String(s.eaten);$('snack-theater').dataset.total=String(s.total);
      $('squirrel-pose').setAttribute('aria-label',(phase==='waiting'||phase==='settle')?'つぎの'+c.snack+'を待つ'+c.label:'並んだ'+c.snack+'を食べる'+c.label);
      $('squirrel-pose').dataset.chewSubframe=String(s.subframe);
      snackVisualKey=key;
    }
    if(phase==='reach'&&!reduced.matches)positionCarriedAcorn(s);
    applyChewPose(s,phase);
    // Only a fresh transition into the chewing part triggers sound. Never replay
    // skipped bites after a hidden tab, reload, delayed frame, pause, or seek.
    if(timer.status==='running'&&phase==='chew'){
      if(s.index!==lastSoundIndex) lastSoundIndex=s.index;
      const cue=s.index+':'+s.chewBeat;
      if(prefs.munch && s.chewBeat>=0 && cue!==lastMunchCue && !document.hidden) playMunch(Math.min(1,Math.max(0,s.stepMs*.8-s.localElapsed)/1000),s.index);
      lastMunchCue=cue;
    } else if(phase!=='chew' && timer.status==='running') {
      lastMunchCue=s.index+':'+s.chewBeat;
    }
    lastSoundPhase=phase;
    if(timer.status==='running'&&!document.hidden&&phase!=='waiting'&&!raf){
      raf=requestAnimationFrame(()=>{raf=0;renderSnacks();});
    }
  }
  function render(force=false){
    const mode=timer.status,changed=lastMode!==mode,sel=choices(),ch=character();
    const completed=mode==='finished'||mode==='acknowledged';
    const wasParentOpen=completed&&$('parent-dialog').open;
    // A menu left open at the deadline must not cover the completion screen.
    if(wasParentOpen)$('parent-dialog').close();
    document.body.dataset.mode=mode;
    $('parent-gate').hidden=!holdRequired();
    $('finished-parent-actions').hidden=!completed;
    $('state-tag').hidden=mode==='idle';
    $('numeral').hidden=mode==='idle'||!prefs.digits;
    $('parent-bar').hidden=mode==='idle';$('finish-panel').hidden=mode!=='finished';$('ack-panel').hidden=mode!=='acknowledged';
    $('next-scene-panel').hidden=mode!=='finished'&&mode!=='acknowledged';
    if(mode!=='running')$('audio-restore').hidden=true;
    if(force||changed){
      $('state-label').textContent={idle:'じゅんび中',running:demo?'おためし中':'タイマー中',paused:'おやすみ中',finished:'おしまい',acknowledged:'つぎの じかん'}[mode];
      const title=$('stage-title'),sub=$('stage-subtitle');
      if(mode==='finished'){title.textContent='おしまいの じかん';sub.textContent=ch.label+'も、つぎの じゅんび。';}
      else if(mode==='acknowledged'){title.textContent='いっしょに、はじめよう。';sub.textContent='タイマーは、ここで おしまい。';}
      else if(mode==='paused'){title.textContent='ちょっと、ひとやすみ。';sub.textContent='じかんは とまっているよ。';}
      else{title.replaceChildren(document.createTextNode(ch.snack+'が なくなったら'),document.createElement('br'),document.createTextNode('おしまい。'));sub.textContent=mode==='idle'?'':'10びょうごとに、ひとつ パクパク。';}
      $('next-icon').setAttribute('href','#i-'+sel.next);
      $('next-label').textContent=NEXT[sel.next];$('ack-title').textContent=NEXT[sel.next]+'の じかん';
      $('parent-hint-quote').textContent='「ぜんぶ なくなったら、'+NEXT[sel.next]+'しようね」';
      $('pause-button').hidden=!holdRequired();$('pause-button').textContent=mode==='paused'?'つづきから はじめる':'いったん とめる';
      $('parent-gate').dataset.instant='false';
      $('gate-label').textContent='おとなの操作 · 長押し';
      $('gate-description').textContent='約2秒長押しでメニューが開きます。Enterまたはスペースの長押し、読み上げソフトの実行操作にも対応します。';
      $('parent-note').textContent='この画面を開くだけでは、時間は止まりません。';
      deviceStatus();
    }
    const sceneId=ch.id+':'+sel.next;
    if(sceneKey!==sceneId){$('next-scene').src=A[ch.nextScene(sel.next)];$('next-scene').alt=SCENE_ALT[ch.id][sel.next];sceneKey=sceneId;}
    const remaining=timer.remaining(),seconds=Math.ceil(remaining/1000);
    if(force||changed||lastSeconds!==seconds){
      const text=formatTime(remaining);$('time-display').textContent=text;$('time-display').setAttribute('aria-label','残り'+timeWords(remaining));
      $('parent-timer-summary').textContent=mode==='finished'||mode==='acknowledged'?timeWords(timer.durationMs)+'のタイマーが終了しました':'残り '+text+(mode==='paused'?'（一時停止中）':'');
      $('acorn-area').setAttribute('aria-valuetext','残り'+timeWords(remaining));$('acorn-area').setAttribute('aria-valuenow',String(Math.round(remaining/timer.durationMs*100)));
      document.title=holdRequired()?text+' · あとすこし':'あとすこし — おしまいが見えるタイマー';lastSeconds=seconds;
    }
    renderSnacks();lastMode=mode;
    // Never leave keyboard focus on a menu trigger that just became hidden.
    if(!document.hidden&&completed&&(changed||wasParentOpen)){
      $(mode==='finished'?'ack-button':'stage-title').focus({preventScroll:true});
    }
  }
  function finishEffects(deadline){
    stopMunch();cancelAnimationFrame(raf);raf=0;cancelGate();
    // A very late return to the page should not make a stale alarm sound.
    if(!document.hidden && Date.now()-deadline<30000 && !chime())toast('おしまいの時間です。音が使えないため、画面でお知らせしています。');
    $('audio-restore').hidden=true;releaseWake();saveSession();
    announce('おしまいの時間です。つぎは'+NEXT[choices().next]+'です。');
  }
  function tick(){const deadline=timer.endAt;if(timer.tick())finishEffects(deadline||Date.now());render();}
  function startSession(duration){
    stopSound();cancelAnimationFrame(raf);raf=0;cancelGate();
    flourishPick=createFlourishPicker();
    timer.reset(duration);timer.start(duration);lastSoundIndex=-1;lastSoundPhase='';lastMunchCue='';gridKey='';snackVisualKey='';
    saveSession();render(true);
    if($('parent-dialog').open)$('parent-dialog').close();
    unlockAudio(true).then(ok=>{if(timer.status==='running')$('audio-restore').hidden=ok;});
    requestWake();$('parent-gate').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
  }
  function begin(isDemo){
    if(timer.status!=='idle')return;demo=isDemo;sessionChoices={next:prefs.next,current:prefs.current};savePrefs();
    startSession((isDemo?20:prefs.seconds)*1000);
    announce(timeWords(timer.durationMs)+'を始めました。つぎは'+NEXT[choices().next]+'です。');
  }
  function restart(){
    if(timer.status==='idle')return;const duration=timer.durationMs;
    // Keep the active session's activity choices and demo duration, not new prefs.
    startSession(duration);announce('同じ'+timeWords(duration)+'で、最初から始めました。');
  }
  function reset(){
    stopSound();cancelAnimationFrame(raf);raf=0;cancelGate();flourishPick=createFlourishPicker();timer.reset(prefs.seconds*1000);sessionChoices=null;demo=false;
    gridKey='';snackVisualKey='';lastSoundIndex=-1;lastMunchCue='';releaseWake();saveSession();
    if($('parent-dialog').open)$('parent-dialog').close();reflectPrefs();
    announce('準備画面に戻りました。');$('start-button').focus({preventScroll:true});
  }
  function cancelGate(){clearTimeout(gateTimer);gateTimer=null;gateStarted=false;$('parent-gate').classList.remove('holding');}
  function showParent(){cancelGate();tick();if(!holdRequired())return;deviceStatus();if(!$('parent-dialog').open)$('parent-dialog').showModal();}
  function startGate(){if(gateStarted||!holdRequired())return;gateStarted=true;$('parent-gate').classList.add('holding');gateTimer=setTimeout(()=>{if(gateStarted&&!document.hidden)showParent();},1800);}

  Object.keys(NEXT).forEach(key=>{
    Object.values(CHARACTERS).forEach(c=>{const img=new Image();img.src=A[c.nextScene(key)];});
  });
  $('duration-choices').addEventListener('click',event=>{
    const b=event.target.closest('button[data-seconds]');
    if(!b || !$('duration-choices').contains(b) || timer.status!=='idle')return;
    if(b.getAttribute('aria-disabled')==='true')return;
    const seconds=Number(b.dataset.seconds);
    if(!prefs.visiblePresets.includes(seconds))return;
    prefs.seconds=seconds;savePrefs();reflectPrefs();
  });
  document.querySelectorAll('[data-visible-preset]').forEach(c=>c.addEventListener('change',()=>{
    if(timer.status!=='idle'){c.checked=prefs.visiblePresets.includes(+c.dataset.visiblePreset);return;}
    const requested=Array.from(document.querySelectorAll('[data-visible-preset]:checked'),el=>+el.dataset.visiblePreset);
    const next=applyVisiblePresets(prefs.seconds,requested);
    if(!next){c.checked=true;announce('時間は、ひとつ以上 選べるようにしておきます。');return;}
    const moved=next.seconds!==prefs.seconds;
    prefs.visiblePresets=next.visiblePresets;prefs.seconds=next.seconds;savePrefs();reflectPrefs();
    announce(moved?timeWords(prefs.seconds*1000)+'に合わせました。':'使える時間を更新しました。');
  }));
  document.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>{if(timer.status!=='idle')return;prefs.next=b.dataset.next;savePrefs();reflectPrefs();}));
  function selectCharacter(id){
    if(timer.status!=='idle'||id===prefs.character||!own(CHARACTERS,id))return;
    prefs.character=id;sceneKey='';savePrefs();applyCharacterAssets();render(true);
    announce(character().label+'に かえました。');
  }
  $('character-prev').addEventListener('click',()=>selectCharacter(cycleCharacter(prefs.character,-1)));
  $('character-next').addEventListener('click',()=>selectCharacter(cycleCharacter(prefs.character,1)));
  for(const [id,key]of [['show-digits','digits'],['keep-awake','awake'],['munch-on','munch']])$(id).addEventListener('change',e=>{prefs[key]=e.target.checked;if(key==='munch'&&!prefs.munch)stopMunch();savePrefs();reflectPrefs();});
  $('test-sound').addEventListener('click',async()=>{if(await unlockAudio())chime();});
  $('test-munch').addEventListener('click',async()=>{if(await unlockAudio()){await loadDefaultAudio();playMunch();}});
  $('unlock-audio').addEventListener('click',async()=>{suppressCurrentSound();await unlockAudio();});
  $('munch-file').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    const version=++fileVersion;
    if(file.size>2*1024*1024){toast('2MB以下の音声ファイルを選んでください。');e.target.value='';return;}
    if(file.type&&!file.type.startsWith('audio/')&&!/\.(wav|mp3|ogg|m4a|aac|flac|webm)$/i.test(file.name)){toast('音声ファイルを選んでください。');e.target.value='';return;}
    if(!await unlockAudio())return;
    try{
      const buf=await audio.decodeAudioData(await file.arrayBuffer());if(version!==fileVersion)return;
      if(buf.duration<.05||buf.duration>2)throw Error('duration');
      // Normalize imported audio to a bounded peak before playback.
      let peak=0;for(let ch=0;ch<buf.numberOfChannels;ch++){const d=buf.getChannelData(ch);for(let i=0;i<d.length;i++)peak=Math.max(peak,Math.abs(d[i]));}
      if(peak>.3){const scale=.3/peak;for(let ch=0;ch<buf.numberOfChannels;ch++){const d=buf.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]*=scale;}}
      stopMunch();munchBuffer=buf;customMunch=true;$('munch-file-name').textContent=file.name+'（このタブだけ）';$('reset-munch').hidden=false;
      toast('パクパクの音を差し替えました。「音をきく」で確認できます。');
    }catch(error){toast(error.message==='duration'?'0.05〜2秒の短い音を選んでください。':'この音声を読み込めませんでした。WAV・MP3などで試してください。');e.target.value='';}
  });
  function restoreDefaultMunch(){fileVersion++;customMunch=false;stopMunch();munchBuffer=defaultMunchBuffer;$('munch-file').value='';$('munch-file-name').textContent='内蔵の「ぱく、ぱく、もく」を使用中';$('reset-munch').hidden=true;}
  $('reset-munch').addEventListener('click',restoreDefaultMunch);
  $('start-button').addEventListener('click',()=>begin(false));$('demo-button').addEventListener('click',()=>begin(true));
  $('restart-button').addEventListener('click',restart);
  $('finished-restart-button').addEventListener('click',()=>{
    if(timer.status==='finished'||timer.status==='acknowledged')restart();
  });
  $('finished-reset-button').addEventListener('click',()=>{
    if(timer.status==='finished'||timer.status==='acknowledged')reset();
  });
  // Deliberately one action, with no additional confirmation dialog.
  $('request-reset').addEventListener('click',reset);
  $('ack-button').addEventListener('click',()=>{
    if(!timer.acknowledge())return;stopSound();saveSession();render(true);announce(NEXT[choices().next]+'の時間です。');$('stage-title').focus({preventScroll:true});
  });
  $('parent-gate').addEventListener('pointerdown',event=>{
    if(event.button!==0||!holdRequired())return;event.preventDefault();$('parent-gate').focus({preventScroll:true});try{$('parent-gate').setPointerCapture(event.pointerId);}catch{}startGate();
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('parent-gate').addEventListener(type,cancelGate));
  $('parent-gate').addEventListener('pointermove',event=>{
    if(!gateStarted)return;const b=$('parent-gate').getBoundingClientRect();if(event.clientX<b.left-10||event.clientX>b.right+10||event.clientY<b.top-10||event.clientY>b.bottom+10)cancelGate();
  });
  $('parent-gate').addEventListener('contextmenu',event=>event.preventDefault());
  $('parent-gate').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&holdRequired()){event.preventDefault();if(!event.repeat)startGate();}});
  $('parent-gate').addEventListener('keyup',event=>{if((event.key==='Enter'||event.key===' ')&&holdRequired()){event.preventDefault();cancelGate();}});
  $('parent-gate').addEventListener('blur',cancelGate);
  $('parent-gate').addEventListener('click',event=>{if(!holdRequired()||(event.detail===0&&!gateStarted))showParent();});
  $('pause-button').addEventListener('click',()=>{
    if(timer.status==='running'){
      const deadline=timer.endAt;
      if(timer.pause()){stopMunch();cancelAnimationFrame(raf);raf=0;releaseWake();announce('時間を一時停止しました。');}
      else if(timer.status==='finished')finishEffects(deadline);
    }else if(timer.status==='paused'){timer.resume();unlockAudio(true);requestWake();announce('つづきから始めました。');}
    saveSession();render(true);$('parent-dialog').close();
  });
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  if(document.fullscreenEnabled&&document.documentElement.requestFullscreen){
    $('fullscreen-button').hidden=false;$('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('この環境では全画面にできません。通常の画面で使えます。');}});
    document.addEventListener('fullscreenchange',()=>$('fullscreen-button').setAttribute('aria-label',document.fullscreenElement?'全画面をやめる':'画面を大きくする'));
  }
  document.addEventListener('visibilitychange',()=>{
    cancelGate();stopMunch();cancelAnimationFrame(raf);raf=0;suppressCurrentSound();
    if(document.hidden){saveSession();releaseWake();return;}
    tick();requestWake();if(timer.status==='running')$('audio-restore').hidden=audioRunning();
  });
  window.addEventListener('pagehide',()=>{saveSession();cancelGate();stopSound();cancelAnimationFrame(raf);raf=0;releaseWake();});
  window.addEventListener('pageshow',()=>{suppressCurrentSound();tick();if(timer.status==='running')requestWake();});
  window.addEventListener('blur',cancelGate);
  window.addEventListener('resize',()=>{snackVisualKey='';renderSnacks();});
  const reduceChanged=()=>{snackVisualKey='';renderSnacks();};
  if(reduced.addEventListener)reduced.addEventListener('change',reduceChanged);else if(reduced.addListener)reduced.addListener(reduceChanged);

  function storedPrefs(){
    const current=readStorage('localStorage',PREF_KEY);
    if(current&&typeof current==='object'){
      const next=sanitizePreferences(current);
      return {prefs:next,migrated:JSON.stringify(next)!==JSON.stringify(current)};
    }
    for(const key of LEGACY_PREF_KEYS){
      const old=readStorage('localStorage',key);
      if(old&&typeof old==='object') return {prefs:sanitizePreferences(old),migrated:true};
    }
    return {prefs:sanitizePreferences(null),migrated:false};
  }
  const loaded=storedPrefs();
  prefs=loaded.prefs;
  if(loaded.migrated) savePrefs();
  const restored=readStorage('sessionStorage',SESSION);
  if(restored&&own(NEXT,restored.choices?.next)&&own(CURRENT,restored.choices?.current)&&timer.restore(restored.timer)){
    sessionChoices={next:restored.choices.next,current:restored.choices.current};demo=restored.demo===true;flourishPick=createFlourishPicker();suppressCurrentSound();reflectPrefs();
    if(timer.status==='running'){$('audio-restore').hidden=false;requestWake();}
    toast('同じタブのタイマーを復元しました。');
  }else reflectPrefs();
  setInterval(()=>{if(!document.hidden&&timer.status==='running')tick();},100);
})();
