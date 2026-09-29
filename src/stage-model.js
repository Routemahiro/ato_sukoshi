/* Stage-home preferences. Durations are presets only.
 * A saved custom length snaps to the nearest enabled preset.
 * An equal distance keeps the shorter preset, so migration never lengthens the wait.
 */
(function (root) {
  'use strict';
  const PRESET_SECONDS = Object.freeze([60, 180, 300, 600, 900, 1200, 1800, 2700, 3600]);
  const DEFAULT_VISIBLE_PRESETS = Object.freeze([60, 180, 300, 600]);
  const CHARACTER_ORDER = Object.freeze(['squirrel', 'elephant', 'mouse', 'ghost']);
  const NEXT_IDS = Object.freeze(['tidy', 'meal', 'bath', 'out', 'brush', 'sleep']);
  const CURRENT_IDS = Object.freeze(['play', 'video', 'book', 'meal']);
  const PREF_KEY = 'atosukoshi.preferences.v3';
  const LEGACY_PREF_KEYS = Object.freeze(['atosukoshi.preferences.v2', 'atosukoshi.preferences.v1']);

  function enabledPresets(list) {
    if (!Array.isArray(list)) return [];
    return PRESET_SECONDS.filter(seconds => list.includes(seconds));
  }

  function nearestEnabledSeconds(seconds, enabled) {
    const pool = enabledPresets(enabled);
    const choices = pool.length ? pool : PRESET_SECONDS;
    let best = choices[0];
    let bestDistance = Math.abs(choices[0] - seconds);
    for (let i = 1; i < choices.length; i++) {
      const distance = Math.abs(choices[i] - seconds);
      if (distance < bestDistance || (distance === bestDistance && choices[i] < best)) {
        best = choices[i];
        bestDistance = distance;
      }
    }
    return best;
  }

  function visibleFrom(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.visiblePresets)) {
      return DEFAULT_VISIBLE_PRESETS.slice();
    }
    const enabled = enabledPresets(value.visiblePresets);
    return enabled.length ? enabled : DEFAULT_VISIBLE_PRESETS.slice();
  }

  function sanitizePreferences(value) {
    const visiblePresets = visibleFrom(value);
    const raw = value && Number.isInteger(value.seconds) && value.seconds >= 1 && value.seconds <= 3600
      ? value.seconds
      : 300;
    const pick = (key, ids, fallback) => value && ids.includes(value[key]) ? value[key] : fallback;
    const flag = (key, fallback) => value && typeof value[key] === 'boolean' ? value[key] : fallback;
    return {
      seconds: nearestEnabledSeconds(raw, visiblePresets),
      next: pick('next', NEXT_IDS, 'tidy'),
      current: pick('current', CURRENT_IDS, 'play'),
      character: pick('character', CHARACTER_ORDER, 'squirrel'),
      munch: flag('munch', true),
      digits: flag('digits', true),
      awake: flag('awake', true),
      visiblePresets
    };
  }

  function applyVisiblePresets(seconds, requested) {
    const visiblePresets = enabledPresets(requested);
    if (!visiblePresets.length) return null;
    return {visiblePresets, seconds: nearestEnabledSeconds(seconds, visiblePresets)};
  }

  function cycleCharacter(id, delta) {
    const count = CHARACTER_ORDER.length;
    const index = CHARACTER_ORDER.indexOf(id);
    const base = index < 0 ? 0 : index;
    const step = ((delta % count) + count) % count;
    return CHARACTER_ORDER[(base + step) % count];
  }

  const SLIDE_MS = 300;

  /* direction 1 (next): the pair moves left and the new pair enters from the right.
   * direction -1 (previous): the opposite. The live pair commits immediately, so a
   * newer tap retargets from that destination instead of the outgoing picture. */
  function characterMotion(fromId, delta) {
    const step = Number.isInteger(delta) ? delta : 0;
    const direction = step > 0 ? 1 : step < 0 ? -1 : 0;
    return {
      from: fromId,
      to: cycleCharacter(fromId, step),
      direction,
      durationMs: SLIDE_MS,
      easing: 'ease-out'
    };
  }

  function createSlideState(showing) {
    return {phase: 'rest', showing, from: showing, direction: 0, generation: 0};
  }

  function reduceCharacterSlide(state, delta) {
    const motion = characterMotion(state.showing, delta);
    if (!motion.direction || motion.to === state.showing) return {state, action: 'none', motion: null};
    const next = {
      phase: 'sliding',
      showing: motion.to,
      from: state.showing,
      direction: motion.direction,
      generation: state.generation + 1
    };
    return {
      state: next,
      action: state.phase === 'sliding' ? 'retarget' : 'start',
      motion: {
        from: state.showing,
        to: motion.to,
        direction: motion.direction,
        durationMs: motion.durationMs,
        easing: motion.easing,
        generation: next.generation
      }
    };
  }

  function settleCharacterSlide(state, generation) {
    if (!state || state.phase !== 'sliding' || state.generation !== generation) return {state, action: 'ignore'};
    return {
      state: {phase: 'rest', showing: state.showing, from: state.showing, direction: 0, generation: state.generation},
      action: 'clear'
    };
  }

  function abortCharacterSlide(state) {
    if (!state || state.phase !== 'sliding') return {state, action: 'ignore'};
    return {
      state: {phase: 'rest', showing: state.showing, from: state.showing, direction: 0, generation: state.generation + 1},
      action: 'snap'
    };
  }

  const api = {
    PRESET_SECONDS, DEFAULT_VISIBLE_PRESETS, CHARACTER_ORDER, NEXT_IDS, CURRENT_IDS,
    PREF_KEY, LEGACY_PREF_KEYS, nearestEnabledSeconds, sanitizePreferences,
    applyVisiblePresets, cycleCharacter, characterMotion, createSlideState,
    reduceCharacterSlide, settleCharacterSlide, abortCharacterSlide
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AtosukoshiStage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
