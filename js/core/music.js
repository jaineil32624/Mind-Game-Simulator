/**
 * App3.core.music — procedural, calm background music via the Web Audio API.
 * No audio files: a slow chord progression (soft pads + bass) with a sparse,
 * randomized pentatonic melody fed through a gentle echo. It never loops
 * exactly, and stays quiet enough not to distract from puzzles.
 *
 * Settings (in storage.state.settings):
 *   music        — boolean, default true (undefined counts as on)
 *   musicVolume  — 0..1, default 0.5
 * The global mute button (settings.muted) silences music as well as effects.
 *
 * Uses a look-ahead scheduler: a timer wakes every SCHEDULER_MS and queues any
 * notes that fall within the next LOOKAHEAD_SEC on the AudioContext clock,
 * which keeps timing tight even when the main thread is busy.
 */
(function (App3) {
  'use strict';

  var BPM = 72;
  var BEAT = 60 / BPM;               // seconds per beat
  var BEATS_PER_BAR = 4;
  var SCHEDULER_MS = 100;
  var LOOKAHEAD_SEC = 0.6;
  var MAX_GAIN = 0.14;               // full-volume level of the music bus
  var FADE_SEC = 1.2;

  /** Converts a MIDI note number to Hz. */
  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // Fmaj7 → G6 → Em7 → Am7 (a warm, unresolved loop). MIDI notes.
  var PROGRESSION = [
    { bass: 41, pad: [57, 60, 64, 65] },  // F2 | A3 C4 E4 F4
    { bass: 43, pad: [59, 62, 64, 67] },  // G2 | B3 D4 E4 G4
    { bass: 40, pad: [55, 59, 62, 64] },  // E2 | G3 B3 D4 E4
    { bass: 45, pad: [57, 60, 64, 67] }   // A2 | A3 C4 E4 G4
  ];
  // C-major / A-minor pentatonic melody pool (A4..E6) — always consonant.
  var MELODY = [69, 72, 74, 76, 79, 81, 84, 86, 88];

  var ctx = null, bus = null, filter = null, echo = null;
  var timer = null;
  var playing = false;
  var nextBarTime = 0;
  var barIndex = 0;
  var lastMelody = 4;

  function settings() {
    var st = App3.core.storage && App3.core.storage.state;
    return (st && st.settings) || {};
  }
  function isEnabled() { return settings().music !== false; }
  function volume() {
    var v = settings().musicVolume;
    return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;
  }
  function shouldPlay() {
    return isEnabled() && !App3.core.audio.isMuted() && volume() > 0 &&
      !(typeof document !== 'undefined' && document.hidden);
  }

  /** Builds the music bus lazily: bus → lowpass → destination, plus echo send. */
  function ensureGraph() {
    if (bus) return true;
    ctx = App3.core.audio.context();
    if (!ctx) return false;
    bus = ctx.createGain();
    bus.gain.value = 0.0001;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    bus.connect(filter);
    filter.connect(ctx.destination);

    // Feedback delay for the melody: dotted-eighth echo, quickly decaying.
    echo = ctx.createDelay(2);
    echo.delayTime.value = BEAT * 0.75;
    var feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    var wet = ctx.createGain();
    wet.gain.value = 0.35;
    echo.connect(feedback);
    feedback.connect(echo);
    echo.connect(wet);
    wet.connect(filter);
    return true;
  }

  /** One enveloped oscillator voice. */
  function voice(freq, start, dur, type, level, attack, dest, detune) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (detune) osc.detune.setValueAtTime(detune, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(level, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(dest || bus);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    return g;
  }

  /** Queues every note of one bar starting at time t. */
  function scheduleBar(t) {
    var chord = PROGRESSION[barIndex % PROGRESSION.length];
    var barLen = BEAT * BEATS_PER_BAR;

    // Pad: slow-attack, slightly detuned pairs for a soft chorus.
    chord.pad.forEach(function (n) {
      voice(hz(n), t, barLen + 0.6, 'sine', 0.05, 0.9, bus, -5);
      voice(hz(n), t, barLen + 0.6, 'triangle', 0.025, 1.1, bus, 6);
    });

    // Bass on beats 1 and 3 (beat 3 sometimes skipped for variety).
    voice(hz(chord.bass), t, BEAT * 1.9, 'sine', 0.16, 0.04);
    if (Math.random() < 0.7) voice(hz(chord.bass), t + BEAT * 2, BEAT * 1.6, 'sine', 0.12, 0.04);

    // Melody: sparse eighth notes doing a small random walk over the pentatonic pool.
    for (var i = 0; i < BEATS_PER_BAR * 2; i++) {
      if (Math.random() > 0.3) continue;
      lastMelody = Math.max(0, Math.min(MELODY.length - 1, lastMelody + Math.floor(Math.random() * 5) - 2));
      var start = t + i * BEAT / 2 + Math.random() * 0.02;     // tiny humanize
      var g = voice(hz(MELODY[lastMelody]), start, BEAT * 1.4, 'sine', 0.06, 0.015);
      g.connect(echo);                                         // send to echo as well
    }
  }

  function tick() {
    if (!ctx) return;
    while (nextBarTime < ctx.currentTime + LOOKAHEAD_SEC) {
      scheduleBar(nextBarTime);
      nextBarTime += BEAT * BEATS_PER_BAR;
      barIndex++;
    }
  }

  function fadeTo(level) {
    var now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
    bus.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), now + FADE_SEC);
  }

  var Music = {
    /** Starts (or resumes) playback if settings allow. Call after a user gesture. */
    start: function () {
      if (!shouldPlay() || !ensureGraph()) return;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
      fadeTo(MAX_GAIN * volume());
      if (playing) return;
      playing = true;
      nextBarTime = ctx.currentTime + 0.1;
      tick();
      timer = setInterval(tick, SCHEDULER_MS);
    },

    /** Fades out and stops scheduling new notes. */
    stop: function () {
      if (!playing) return;
      playing = false;
      clearInterval(timer);
      timer = null;
      fadeTo(0.0001);
    },

    /** Re-evaluates settings/visibility and starts, stops or re-levels accordingly. */
    sync: function () {
      if (shouldPlay()) Music.start(); else Music.stop();
    },

    isEnabled: isEnabled,
    volume: volume,

    setEnabled: function (on) {
      var storage = App3.core.storage;
      storage.state.settings.music = !!on;
      storage.save();
      App3.core.events.emit('settings:changed', { key: 'music', value: !!on });
    },

    setVolume: function (v) {
      var storage = App3.core.storage;
      storage.state.settings.musicVolume = Math.max(0, Math.min(1, v));
      storage.save();
      App3.core.events.emit('settings:changed', { key: 'musicVolume', value: storage.state.settings.musicVolume });
    }
  };

  // Pause while the tab is hidden; resume when it comes back.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () { if (bus) Music.sync(); });
  }

  App3.core.music = Music;
})(window.App3);
