const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');

function at(source, needle) {
  const index = source.indexOf(needle);
  assert.ok(index >= 0, needle);
  return index;
}

test('setup lives on the stage in one column', () => {
  assert.equal(html.includes('class="settings'), false);
  assert.equal(html.includes('おとなが じゅんび'), false);
  assert.equal(html.includes('app-grid'), false);
  assert.equal(html.includes('id="acorn-unit"'), false);
  assert.equal(html.includes('じゅんび中'), false);
  assert.equal(html.includes('どんぐり 1こ'), false);
  assert.ok(html.includes('id="brand-icon"'));
  assert.ok(html.includes('<h1 class="brand-name">あとすこし</h1>'));
  assert.ok(html.includes('>せってい</summary>'));
  assert.ok(html.includes('id="settings-details"'));
  assert.equal(html.includes('id="snack-timing-note"'), false);
  for (const id of ['custom-minutes', 'custom-seconds', 'apply-custom', 'custom-error', 'custom-details', 'time-selection-note', 'extra-settings', 'settings-heading']) {
    assert.equal(html.includes('id="' + id + '"'), false, id);
  }
});

test('focus order is duration, animal arrows, next activity, start, demo, settings', () => {
  const order = [
    'id="duration-choices"',
    'id="character-prev"',
    'id="character-next"',
    'id="next-choices"',
    'id="start-button"',
    'id="demo-button"',
    'id="parent-hint-quote"',
    'id="settings-details"'
  ];
  let cursor = -1;
  for (const needle of order) {
    const index = at(html, needle);
    assert.ok(index > cursor, needle);
    cursor = index;
  }
  assert.ok(at(html, 'id="show-digits"') > at(html, 'id="settings-details"'));
  assert.ok(at(html, 'id="test-sound"') > at(html, 'id="settings-details"'));
  assert.ok(html.includes('チェックした時間だけ、上のボタンで選べます。'));
});

test('running numeral and idle controls are split by mode classes', () => {
  assert.ok(html.includes('id="duration-choices" class="durations setup-only"'));
  assert.ok(html.includes('id="state-tag"'));
  assert.ok(html.includes('class="numeral session-only"'));
  assert.ok(html.includes('class="activity-block session-only"'));
  assert.ok(html.includes('class="next-setup setup-only"'));
  assert.ok(css.includes('body:not([data-mode=idle]) .setup-only'));
  assert.ok(css.includes('body[data-mode=idle] .session-only'));
  assert.ok(css.includes('.time-choice[aria-disabled=true]'));
});

test('app wires disabling, cycling, migration, and the food icon', () => {
  assert.ok(app.includes("b.setAttribute('aria-disabled',String(!enabled.has(seconds)))"));
  assert.ok(app.includes("b.getAttribute('aria-disabled')==='true'"));
  assert.ok(app.includes('applyVisiblePresets(prefs.seconds,requested)'));
  assert.ok(app.includes('cycleCharacter(prefs.character,-1)'));
  assert.ok(app.includes('cycleCharacter(prefs.character,1)'));
  assert.ok(app.includes('sanitizePreferences'));
  assert.ok(app.includes('PREF_KEY'));
  assert.ok(app.includes('LEGACY_PREF_KEYS'));
  assert.ok(app.includes("$('brand-icon').src=A[c.snackIcon]"));
  assert.ok(app.includes("$('state-tag').hidden=mode==='idle'"));
  assert.ok(app.includes("$('numeral').hidden=mode==='idle'||!prefs.digits"));
  assert.equal(app.includes('custom-minutes'), false);
  assert.equal(app.includes('acorn-unit'), false);
  assert.equal(app.includes('snack-timing-note'), false);
});
