const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRESET_SECONDS, DEFAULT_VISIBLE_PRESETS, CHARACTER_ORDER, PREF_KEY, LEGACY_PREF_KEYS,
  nearestEnabledSeconds, sanitizePreferences, applyVisiblePresets, cycleCharacter,
  characterMotion, createSlideState, reduceCharacterSlide, settleCharacterSlide, abortCharacterSlide
} = require('../src/stage-model.js');

test('schema key moves to v3 and still names the old keys', () => {
  assert.equal(PREF_KEY, 'atosukoshi.preferences.v3');
  assert.deepEqual([...LEGACY_PREF_KEYS], ['atosukoshi.preferences.v2', 'atosukoshi.preferences.v1']);
});

test('nearest preset keeps an enabled selection and breaks ties toward the shorter time', () => {
  assert.equal(nearestEnabledSeconds(300, [60, 180, 300, 600]), 300);
  assert.equal(nearestEnabledSeconds(90, [60, 180, 300, 600]), 60);
  assert.equal(nearestEnabledSeconds(240, [60, 180, 300, 600]), 180);
  assert.equal(nearestEnabledSeconds(450, [300, 600]), 300);
  assert.equal(nearestEnabledSeconds(900, [60, 180, 300, 600]), 600);
  assert.equal(nearestEnabledSeconds(3600, [60]), 60);
});

test('saved custom duration migrates to the nearest enabled preset', () => {
  const prefs = sanitizePreferences({
    seconds: 90,
    visiblePresets: [60, 180, 300, 600],
    next: 'meal',
    current: 'book',
    character: 'ghost',
    munch: false,
    digits: false,
    awake: false
  });
  assert.equal(prefs.seconds, 60);
  assert.deepEqual(prefs.visiblePresets, [60, 180, 300, 600]);
  assert.equal(prefs.next, 'meal');
  assert.equal(prefs.current, 'book');
  assert.equal(prefs.character, 'ghost');
  assert.equal(prefs.munch, false);
  assert.equal(prefs.digits, false);
  assert.equal(prefs.awake, false);
});

test('a custom length between presets survives a reload shape', () => {
  const prefs = sanitizePreferences({seconds: 7, next: 'sleep', character: 'mouse', visiblePresets: [300, 900, 3600]});
  assert.equal(prefs.seconds, 300);
  assert.equal(prefs.character, 'mouse');
  assert.equal(prefs.next, 'sleep');
});

test('missing or empty usable times fall back to the original four, then snap', () => {
  const missing = sanitizePreferences({seconds: 900, character: 'elephant'});
  assert.deepEqual(missing.visiblePresets, [...DEFAULT_VISIBLE_PRESETS]);
  assert.equal(missing.seconds, 600);
  assert.equal(missing.character, 'elephant');

  const empty = sanitizePreferences({seconds: 2000, visiblePresets: []});
  assert.deepEqual(empty.visiblePresets, [60, 180, 300, 600]);
  assert.equal(empty.seconds, 600);

  const junk = sanitizePreferences(null);
  assert.equal(junk.seconds, 300);
  assert.equal(junk.character, 'squirrel');
  assert.equal(junk.next, 'tidy');
});

test('unknown preset ids are dropped and an already enabled choice is kept', () => {
  const prefs = sanitizePreferences({seconds: 900, visiblePresets: [900, 42, 3600, 900]});
  assert.deepEqual(prefs.visiblePresets, [900, 3600]);
  assert.equal(prefs.seconds, 900);
});

test('disabling the selected duration selects the nearest one that stays on', () => {
  const next = applyVisiblePresets(300, [60, 600]);
  assert.equal(next.seconds, 60);
  assert.deepEqual(next.visiblePresets, [60, 600]);
  assert.equal(applyVisiblePresets(60, []), null);
  assert.equal(applyVisiblePresets(600, [600]).seconds, 600);
});

test('character cycle wraps squirrel, elephant, mouse, ghost', () => {
  assert.deepEqual([...CHARACTER_ORDER], ['squirrel', 'elephant', 'mouse', 'ghost']);
  assert.equal(cycleCharacter('squirrel', 1), 'elephant');
  assert.equal(cycleCharacter('elephant', 1), 'mouse');
  assert.equal(cycleCharacter('mouse', 1), 'ghost');
  assert.equal(cycleCharacter('ghost', 1), 'squirrel');
  assert.equal(cycleCharacter('squirrel', -1), 'ghost');
  assert.equal(cycleCharacter('ghost', -1), 'mouse');
  assert.equal(cycleCharacter('mouse', -1), 'elephant');
  let id = 'squirrel';
  for (let i = 0; i < CHARACTER_ORDER.length; i++) id = cycleCharacter(id, 1);
  assert.equal(id, 'squirrel');
});

test('preset catalogue stays the nine minute marks', () => {
  assert.deepEqual([...PRESET_SECONDS], [60, 180, 300, 600, 900, 1200, 1800, 2700, 3600]);
});

test('next slides left and previous slides right within the ease-out window', () => {
  const next = characterMotion('squirrel', 1);
  assert.equal(next.from, 'squirrel');
  assert.equal(next.to, 'elephant');
  assert.equal(next.direction, 1);
  assert.equal(next.easing, 'ease-out');
  assert.ok(next.durationMs >= 250 && next.durationMs <= 350);
  const prev = characterMotion('squirrel', -1);
  assert.equal(prev.to, 'ghost');
  assert.equal(prev.direction, -1);
  assert.equal(characterMotion('mouse', 0).direction, 0);
  assert.equal(characterMotion('mouse', 1.5).direction, 0);
});

test('rapid slides commit the latest character and ignore a stale settle', () => {
  let state = createSlideState('squirrel');
  const seen = [];
  for (let i = 0; i < 5; i++) {
    const step = reduceCharacterSlide(state, 1);
    assert.equal(step.action, i === 0 ? 'start' : 'retarget');
    assert.equal(step.motion.direction, 1);
    assert.equal(step.motion.from, state.showing);
    state = step.state;
    seen.push(state.showing);
    assert.equal(state.phase, 'sliding');
  }
  assert.deepEqual(seen, ['elephant', 'mouse', 'ghost', 'squirrel', 'elephant']);
  const stale = settleCharacterSlide(state, state.generation - 1);
  assert.equal(stale.action, 'ignore');
  assert.equal(stale.state.phase, 'sliding');
  const settled = settleCharacterSlide(state, state.generation);
  assert.equal(settled.action, 'clear');
  assert.equal(settled.state.phase, 'rest');
  assert.equal(settled.state.showing, 'elephant');
  assert.equal(settleCharacterSlide(settled.state, settled.state.generation).action, 'ignore');
});

test('abort snaps to the committed character and drops an in-flight settle', () => {
  let state = createSlideState('ghost');
  state = reduceCharacterSlide(state, -1).state;
  assert.equal(state.showing, 'mouse');
  assert.equal(state.direction, -1);
  const generation = state.generation;
  const snapped = abortCharacterSlide(state);
  assert.equal(snapped.action, 'snap');
  assert.equal(snapped.state.phase, 'rest');
  assert.equal(snapped.state.showing, 'mouse');
  assert.ok(snapped.state.generation > generation);
  assert.equal(settleCharacterSlide(snapped.state, generation).action, 'ignore');
  assert.equal(abortCharacterSlide(snapped.state).action, 'ignore');
  let back = createSlideState('squirrel');
  for (let i = 0; i < 5; i++) back = reduceCharacterSlide(back, -1).state;
  assert.equal(back.showing, 'ghost');
});
