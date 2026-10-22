/**
 * App3.games.BaseGame — the contract every game mode implements.
 *
 * Lifecycle (driven by ui/screens/game.js):
 *   const game = new MyGame({ container, difficulty, seed, onComplete, daily });
 *   game.start();          // generate() using this.rng, then render()
 *   game.onKey(event);     // keyboard forwarded by the screen; return true if handled
 *   game.getHint();        // -> { text } or null (hint system enforces limits/costs)
 *   game.destroy();        // remove listeners/timers when leaving the screen
 *
 * A game finishes by calling this.complete({ won, accuracy }) exactly once.
 *
 * Static metadata (assign `MyGame.meta = {...}`):
 *   id, name, description, icon, color, parTime: { easy, medium, hard, expert } (seconds)
 *
 * Generators must draw ALL randomness from `this.rng` (seeded) so daily
 * challenges are identical for every player.
 */
(function (App3) {
  'use strict';

  var RNG = App3.core.RNG;
  var utils = App3.core.utils;

  class BaseGame {
    /**
     * @param {object} options
     * @param {HTMLElement} options.container  element the game renders into
     * @param {string} options.difficulty      'easy' | 'medium' | 'hard' | 'expert'
     * @param {number|string} options.seed     RNG seed (daily or random)
     * @param {function} [options.onComplete]  called with { won, accuracy, details }
     * @param {boolean} [options.daily]
     */
    constructor(options) {
      options = options || {};
      this.options = options;
      this.difficulty = options.difficulty || 'easy';
      this.seed = options.seed !== undefined ? options.seed : RNG.randomSeed();
      this.rng = RNG.create(this.seed);
      this.root = options.container || null;
      this.onComplete = options.onComplete || function () {};
      this.hintsUsed = 0;
      this.finished = false;
      this.startTime = 0;
      this.endTime = 0;
      this._cleanup = [];
      this._timers = [];
    }

    /** Generate the puzzle and draw it. */
    start() {
      this.generate();
      this.startTime = Date.now();
      if (this.root) this.render();
    }

    /** Build puzzle state from this.rng. Must be overridden. */
    generate() { throw new Error(this.constructor.name + '.generate() not implemented'); }

    /** Render into this.root. Must be overridden. */
    render() { throw new Error(this.constructor.name + '.render() not implemented'); }

    /** Return { text } describing (and optionally applying) a useful hint, or null. */
    getHint() { return null; }

    /** Handle a keydown event. Return true when consumed. */
    onKey(/* event */) { return false; }

    /** Milliseconds since start (frozen once finished). */
    elapsed() {
      if (!this.startTime) return 0;
      return (this.endTime || Date.now()) - this.startTime;
    }

    /**
     * Finish the puzzle. Safe to call more than once (only the first counts).
     * @param {{won:boolean, accuracy:number, details?:object, delay?:number}} result
     */
    complete(result) {
      if (this.finished) return;
      this.finished = true;
      this.endTime = Date.now();
      var payload = {
        won: !!result.won,
        accuracy: utils.clamp(typeof result.accuracy === 'number' && isFinite(result.accuracy) ? result.accuracy : 1, 0, 1),
        details: result.details || {}
      };
      var self = this;
      this.later(function () { self.onComplete(payload); }, typeof result.delay === 'number' ? result.delay : 500);
    }

    /** addEventListener that is automatically removed on destroy(). */
    listen(target, type, handler, opts) {
      target.addEventListener(type, handler, opts);
      this._cleanup.push(function () { target.removeEventListener(type, handler, opts); });
    }

    /** setTimeout that is automatically cleared on destroy(). */
    later(fn, ms) {
      var id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    }

    sound(name) { if (App3.core.audio) App3.core.audio.play(name); }

    destroy() {
      this._cleanup.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
      this._cleanup = [];
      this._timers.forEach(function (id) { clearTimeout(id); });
      this._timers = [];
      if (this.root) this.root.innerHTML = '';
    }
  }

  App3.games.BaseGame = BaseGame;
})(window.App3);
