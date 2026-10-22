/**
 * App3.systems.daily — daily challenges and streaks.
 *
 * The daily set is derived purely from the local date string via a seeded
 * RNG, so every player on the same date gets exactly the same three puzzles
 * (same modes, difficulties and generator seeds). Completing all three
 * completes the day and advances the streak.
 */
(function (App3) {
  'use strict';

  var storage = App3.core.storage;
  var events = App3.core.events;
  var utils = App3.core.utils;
  var RNG = App3.core.RNG;

  var ITEMS_PER_DAY = 3;
  /** Difficulty tiers for slots 1..3 (one is picked per slot each day). */
  var TIERS = [['easy', 'medium'], ['medium', 'hard'], ['hard', 'expert']];
  var KEEP_DAYS = 90;

  function seedFor(key) { return RNG.hashString('app3-daily:' + key); }

  /** The challenge for a date key (default: today). Pure & deterministic. */
  function getChallenge(key) {
    key = key || utils.dateKey();
    var rng = RNG.create(seedFor(key));
    var ids = App3.games.registry.ids(); // alphabetical => stable across installs
    var chosen = rng.sample(ids, Math.min(ITEMS_PER_DAY, ids.length));
    var items = chosen.map(function (mode, i) {
      return {
        index: i,
        mode: mode,
        difficulty: rng.pick(TIERS[i] || TIERS[TIERS.length - 1]),
        seed: rng.int(1, 0x7ffffffe)
      };
    });
    return { date: key, items: items };
  }

  function dayRecord(key) {
    var c = storage.state.daily.completed;
    return c[key] || null;
  }

  function isDone(key, index) {
    var rec = dayRecord(key);
    return !!(rec && rec.items && rec.items[index]);
  }

  function isDayComplete(key) {
    var rec = dayRecord(key);
    return !!(rec && rec.complete);
  }

  /** Current streak — only "alive" if the last completed day is today or yesterday. */
  function currentStreak() {
    var d = storage.state.daily;
    if (!d.lastDate) return 0;
    var today = utils.dateKey();
    if (d.lastDate === today || d.lastDate === utils.addDays(today, -1)) return d.streak;
    return 0;
  }

  function prune() {
    var c = storage.state.daily.completed;
    var cutoff = utils.addDays(utils.dateKey(), -KEEP_DAYS);
    Object.keys(c).forEach(function (k) { if (k < cutoff) delete c[k]; });
  }

  /**
   * Mark one daily item as solved.
   * @returns {{dayComplete:boolean, streak:number, newlyComplete:boolean}}
   */
  function markDone(key, index) {
    var d = storage.state.daily;
    var rec = d.completed[key] || (d.completed[key] = { items: {}, complete: false });
    rec.items[index] = Date.now();
    var challenge = getChallenge(key);
    var all = challenge.items.every(function (it) { return !!rec.items[it.index]; });
    var newlyComplete = false;
    if (all && !rec.complete) {
      rec.complete = true;
      newlyComplete = true;
      if (d.lastDate === utils.addDays(key, -1)) d.streak += 1;
      else if (d.lastDate !== key) d.streak = 1;
      d.lastDate = key;
      d.bestStreak = Math.max(d.bestStreak || 0, d.streak);
    }
    prune();
    storage.save();
    if (newlyComplete) events.emit('daily:completed', { date: key, streak: d.streak });
    return { dayComplete: rec.complete, streak: currentStreak(), newlyComplete: newlyComplete };
  }

  /** ms until local midnight (for the "next challenge in" countdown). */
  function msUntilTomorrow() {
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next - now;
  }

  App3.systems.daily = {
    getChallenge: getChallenge,
    seedFor: seedFor,
    isDone: isDone,
    isDayComplete: isDayComplete,
    markDone: markDone,
    currentStreak: currentStreak,
    bestStreak: function () { return storage.state.daily.bestStreak || 0; },
    msUntilTomorrow: msUntilTomorrow,
    todayKey: function () { return utils.dateKey(); }
  };
})(window.App3);
