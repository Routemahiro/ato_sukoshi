const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRESET_SECONDS, DEFAULT_VISIBLE_PRESETS, CHARACTER_ORDER, PREF_KEY, LEGACY_PREF_KEYS,
  nearestEnabledSeconds, sanitizePreferences, applyVisiblePresets, cycleCharacter
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
