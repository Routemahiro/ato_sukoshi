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

test('release version is 9.3.0', () => {
  assert.ok(html.includes('content="9.3.0"'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '9.3.0');
  const notes = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  assert.ok(notes.includes('## 9.3.0'));
  assert.equal(notes.includes('## 9.2.0'), true);
  assert.equal(notes.includes('## 9.1.0'), true);
});

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
  assert.ok(app.includes('function shiftCharacter(delta)'));
  assert.ok(app.includes("if(timer.status!=='idle')return;"));
  assert.ok(app.includes('reduceCharacterSlide(slide,delta)'));
  assert.ok(app.includes('shiftCharacter(-1)'));
  assert.ok(app.includes('shiftCharacter(1)'));
  assert.ok(app.includes('classifyStageGesture('));
  assert.ok(app.includes('shiftCharacter(gesture.delta)'));
  assert.ok(app.includes("gesture.kind==='horizontal-swipe'"));
  assert.ok(app.includes('swallowStageClick'));
  assert.ok(app.includes("event.key!=='ArrowLeft'&&event.key!=='ArrowRight'"));
  assert.ok(app.includes('abortCharacterSlide(slide)'));
  assert.ok(app.includes('reduced.matches'));
  assert.ok(app.includes('translate3d'));
  assert.ok(app.includes('sanitizePreferences'));
  assert.ok(app.includes('PREF_KEY'));
  assert.ok(app.includes('LEGACY_PREF_KEYS'));
  assert.ok(app.includes("$('brand-icon').src=A[c.snackIcon]"));
  assert.ok(app.includes("$('state-tag').hidden=mode==='idle'"));
  assert.ok(app.includes("$('numeral').hidden=mode==='idle'||!prefs.digits"));
  assert.equal(app.includes('custom-minutes'), false);
  assert.equal(app.includes('acorn-unit'), false);
  assert.equal(app.includes('snack-timing-note'), false);
  assert.equal(app.includes('cycleCharacter('), false);
});

test('the finished screen is the only end state', () => {
  assert.equal(html.includes('つぎへ いこう'), false);
  assert.equal(html.includes('id="ack-button"'), false);
  assert.equal(html.includes('id="ack-panel"'), false);
  assert.equal(html.includes('id="finish-panel"'), false);
  assert.equal(html.includes('id="ack-title"'), false);
  assert.ok(html.includes('id="next-scene-panel"'));
  assert.ok(html.includes('id="finished-restart-button"'));
  assert.ok(html.includes('id="finished-reset-button"'));
  assert.equal(app.includes('acknowledged'), false);
  assert.equal(app.includes('acknowledge'), false);
  assert.equal(app.includes('ack-button'), false);
  assert.equal(css.includes('acknowledged'), false);
  assert.equal(css.includes('.ack-panel'), false);
  assert.equal(css.includes('.finish-panel'), false);
  assert.ok(app.includes("title.textContent='おしまいの じかん'"));
  assert.ok(app.includes("sub.textContent=ch.label+'も、つぎの じゅんび。'"));
  assert.ok(app.includes("$('stage-title').focus({preventScroll:true})"));
  assert.equal(app.includes("?'ack-button'"), false);
});

test('chevrons sit above the animal and the pair slides inside a clip', () => {
  assert.ok(html.includes('class="character-switch setup-only"'));
  assert.ok(html.includes('aria-label="まえの なかま"'));
  assert.ok(html.includes('aria-label="つぎの なかま"'));
  assert.ok(html.includes('class="character-chevron"'));
  assert.equal(html.includes('character-arrow'), false);
  assert.equal(html.includes('前のなかま'), false);
  assert.equal(html.includes('次のなかま'), false);
  const track = at(html, 'id="stage-track"');
  const prev = at(html, 'id="character-prev"');
  const next = at(html, 'id="character-next"');
  const pair = at(html, 'id="stage-pair"');
  const pose = at(html, 'id="squirrel-pose"');
  const board = at(html, 'id="acorn-area"');
  assert.ok(track < prev && prev < next && next < pair && pair < pose && pose < board);
  assert.ok(html.indexOf('id="stage-pair"') < html.lastIndexOf('</div>', html.indexOf('id="flying-acorn"')));
  assert.equal(css.includes('.character-arrow'), false);
  assert.equal(css.includes('#f8fbf4ee'), false);
  assert.ok(css.includes('.character-half'));
  assert.ok(css.includes('background: none'));
  assert.ok(css.includes('box-shadow: none'));
  assert.ok(css.includes('.stage-track { position: relative; overflow: hidden; }'));
  assert.ok(css.includes('.stage-track, .stage-track * { touch-action: pan-y; }'));
  assert.ok(css.includes('body[data-mode=idle] .squirrel-space { padding-top: 36px; }'));
  assert.ok(css.includes('.stage-pair-out'));
});
