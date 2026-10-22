/**
 * App3.core.audio — procedural sound effects via the Web Audio API.
 * No audio files: every sound is a short sequence of synthesized notes.
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is
 * created lazily on the first play()/unlock() call.
 */
(function (App3) {
  'use strict';

  var ctx = null;
  var master = null;

  function ensureContext() {
    if (ctx) return ctx;
    var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  /**
   * Note tuple: [frequencyHz, startOffsetSec, durationSec, waveType, volume, slideToHz?]
   */
  var SOUNDS = {
    click:       [[640, 0, 0.045, 'square', 0.12]],
    flip:        [[480, 0, 0.07, 'triangle', 0.35, 760]],
    match:       [[660, 0, 0.08, 'sine', 0.45], [990, 0.07, 0.14, 'sine', 0.4]],
    correct:     [[523.25, 0, 0.09, 'sine', 0.45], [783.99, 0.08, 0.16, 'sine', 0.45]],
    error:       [[220, 0, 0.16, 'sawtooth', 0.18, 140]],
    hint:        [[880, 0, 0.08, 'triangle', 0.3], [1174.66, 0.08, 0.12, 'triangle', 0.25]],
    win:         [[523.25, 0, 0.12, 'triangle', 0.4], [659.25, 0.11, 0.12, 'triangle', 0.4],
                  [783.99, 0.22, 0.12, 'triangle', 0.4], [1046.5, 0.33, 0.3, 'triangle', 0.45]],
    lose:        [[392, 0, 0.16, 'sine', 0.35], [311.13, 0.15, 0.16, 'sine', 0.35], [261.63, 0.3, 0.3, 'sine', 0.35]],
    levelup:     [[523.25, 0, 0.1, 'square', 0.18], [659.25, 0.09, 0.1, 'square', 0.18], [783.99, 0.18, 0.1, 'square', 0.18],
                  [1046.5, 0.27, 0.1, 'square', 0.2], [1318.5, 0.36, 0.35, 'triangle', 0.35]],
    achievement: [[880, 0, 0.1, 'sine', 0.4], [1108.73, 0.1, 0.1, 'sine', 0.4], [1318.51, 0.2, 0.32, 'sine', 0.45],
                  [1760, 0.2, 0.32, 'sine', 0.12]]
  };

  function isMuted() {
    var st = App3.core.storage && App3.core.storage.state;
    return !!(st && st.settings && st.settings.muted);
  }

  function playNote(n, t0) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var start = t0 + n[1];
    var dur = n[2];
    osc.type = n[3] || 'sine';
    osc.frequency.setValueAtTime(n[0], start);
    if (n[5]) osc.frequency.exponentialRampToValueAtTime(n[5], start + dur);
    // Short attack + exponential release avoids clicks.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, n[4] || 0.3), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  var Audio = {
    SOUNDS: SOUNDS,

    /** Play a named sound effect (no-op when muted or unsupported). */
    play: function (name) {
      if (isMuted()) return;
      var notes = SOUNDS[name];
      if (!notes) return;
      var c = ensureContext();
      if (!c) return;
      try {
        if (c.state === 'suspended') c.resume();
        var t0 = c.currentTime + 0.01;
        notes.forEach(function (n) { playNote(n, t0); });
      } catch (e) { /* audio is best-effort */ }
    },

    /** Call from a user gesture to satisfy autoplay policies. */
    unlock: function () {
      var c = ensureContext();
      if (c && c.state === 'suspended') { try { c.resume(); } catch (e) { /* ignore */ } }
    },

    isMuted: isMuted,

    setMuted: function (muted) {
      var storage = App3.core.storage;
      storage.state.settings.muted = !!muted;
      storage.save();
      App3.core.events.emit('settings:changed', { key: 'muted', value: !!muted });
    }
  };

  App3.core.audio = Audio;
})(window.App3);
