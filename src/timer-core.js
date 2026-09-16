/* Small, dependency-free timer. All deadlines use absolute epoch milliseconds.
 * UI refresh rate never changes the duration. OS clock changes remain a limitation. */
(function (root) {
  'use strict';
  const MODES = ['idle', 'running', 'paused', 'finished', 'acknowledged'];
  class Countdown {
    constructor(clock = () => Date.now()) {
      this.clock = clock;
      this.status = 'idle';
      this.durationMs = 300000;
      this.remainingMs = this.durationMs;
      this.endAt = null;
    }
    static validDuration(value) {
      return Number.isFinite(value) && Number.isInteger(value) && value >= 1000 && value <= 3600000;
    }
    start(durationMs) {
      if (!Countdown.validDuration(durationMs)) throw new RangeError('Duration must be 1–3600 seconds.');
      if (this.status === 'running' || this.status === 'paused') return false;
      this.durationMs = durationMs;
      this.remainingMs = durationMs;
      this.endAt = this.clock() + durationMs;
      this.status = 'running';
      return true;
    }
    remaining(now = this.clock()) {
      if (this.status === 'finished' || this.status === 'acknowledged') return 0;
      const value = this.status === 'running' ? this.endAt - now : this.remainingMs;
      return Math.min(this.durationMs, Math.max(0, value));
    }
    tick() {
      if (this.status !== 'running' || this.remaining() > 0) return false;
      this.status = 'finished';
      this.remainingMs = 0;
      this.endAt = null;
      return true;
    }
    pause() {
      if (this.status !== 'running') return false;
      if (this.tick()) return false;
      this.remainingMs = this.remaining();
      this.endAt = null;
      this.status = 'paused';
      return true;
    }
    resume() {
      if (this.status !== 'paused' || this.remainingMs <= 0) return false;
      this.endAt = this.clock() + this.remainingMs;
      this.status = 'running';
      return true;
    }
    acknowledge() {
      if (this.status !== 'finished') return false;
      this.status = 'acknowledged';
      return true;
    }
    reset(durationMs = this.durationMs) {
      if (!Countdown.validDuration(durationMs)) throw new RangeError('Invalid duration.');
      this.durationMs = durationMs;
      this.remainingMs = durationMs;
      this.endAt = null;
      this.status = 'idle';
    }
    snapshot() {
      return {version: 1, status: this.status, durationMs: this.durationMs,
        remainingMs: this.remaining(), endAt: this.endAt, savedAt: this.clock()};
    }
    restore(data) {
      if (!data || data.version !== 1 || !MODES.includes(data.status) || data.status === 'idle' ||
          !Countdown.validDuration(data.durationMs) || !Number.isFinite(data.savedAt) ||
          !Number.isFinite(data.remainingMs) || data.remainingMs < 0 || data.remainingMs > data.durationMs ||
          (data.status === 'running' && (!Number.isFinite(data.endAt) || data.endAt <= 0)) ||
          (data.status === 'paused' && data.remainingMs <= 0)) return false;
      this.status = data.status;
      this.durationMs = data.durationMs;
      this.remainingMs = data.remainingMs;
      this.endAt = data.status === 'running' ? data.endAt : null;
      this.tick();
      return true;
    }
  }
  function formatTime(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  function acornFractions(durationMs, remainingMs) {
    const count = Math.min(10, Math.max(1, Math.ceil(durationMs / 60000)));
    const unit = durationMs / count;
    const elapsed = durationMs - Math.min(durationMs, Math.max(0, remainingMs));
    return Array.from({length: count}, (_, i) => Math.min(1, Math.max(0, 1 - (elapsed - i * unit) / unit)));
  }
  const api = {Countdown, formatTime, acornFractions};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Atosukoshi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
