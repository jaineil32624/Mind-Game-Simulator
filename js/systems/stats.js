/**
 * App3.systems.stats — per-mode statistics.
 *
 * Stored per mode:
 *   played, won, wonTime (ms, summed over wins), accSum (sum of accuracies),
 *   hints, bestTime { difficulty -> ms }, history [{ t, d, won, ms, acc }] (last 60)
 */
(function (App3) {
  'use strict';

  var storage = App3.core.storage;
  var utils = App3.core.utils;
  var HISTORY_LIMIT = 60;

  function emptyModeStats() {
    return { played: 0, won: 0, wonTime: 0, accSum: 0, hints: 0, bestTime: {}, history: [] };
  }

  function ensure(mode) {
    var all = storage.state.stats;
    if (!all[mode]) all[mode] = emptyModeStats();
    else all[mode] = utils.deepMerge(emptyModeStats(), all[mode]);
    return all[mode];
  }

  /**
   * Record a finished puzzle.
   * @param {{mode, difficulty, won, timeMs, accuracy, hintsUsed}} r
   */
  function record(r) {
    var s = ensure(r.mode);
    var acc = utils.clamp(typeof r.accuracy === 'number' ? r.accuracy : 0, 0, 1);
    s.played += 1;
    s.accSum += acc;
    s.hints += r.hintsUsed || 0;
    if (r.won) {
      s.won += 1;
      s.wonTime += r.timeMs;
      var prev = s.bestTime[r.difficulty];
      if (!prev || r.timeMs < prev) s.bestTime[r.difficulty] = r.timeMs;
    }
    s.history.push({ t: Date.now(), d: r.difficulty, won: !!r.won, ms: r.timeMs, acc: Math.round(acc * 1000) / 1000 });
    if (s.history.length > HISTORY_LIMIT) s.history.splice(0, s.history.length - HISTORY_LIMIT);

    var c = storage.state.counters;
    c.totalPlayed = (c.totalPlayed || 0) + 1;
    if (r.won) c.totalWon = (c.totalWon || 0) + 1;
    storage.save();
  }

  /** Derived numbers for one mode. */
  function summary(mode) {
    var s = storage.state.stats[mode] || emptyModeStats();
    var bests = Object.keys(s.bestTime).map(function (k) { return s.bestTime[k]; });
    return {
      played: s.played,
      won: s.won,
      winRate: s.played ? s.won / s.played : null,
      bestTime: bests.length ? Math.min.apply(null, bests) : null,
      bestTimeByDifficulty: utils.clone(s.bestTime),
      avgTime: s.won ? s.wonTime / s.won : null,
      accuracy: s.played ? s.accSum / s.played : null,
      hints: s.hints,
      history: s.history.slice()
    };
  }

  /** Totals across all modes. */
  function overall() {
    var all = storage.state.stats;
    var t = { played: 0, won: 0, accSum: 0, wonTime: 0, hints: 0, modesPlayed: 0 };
    Object.keys(all).forEach(function (m) {
      var s = all[m];
      t.played += s.played; t.won += s.won; t.accSum += s.accSum; t.wonTime += s.wonTime; t.hints += s.hints || 0;
      if (s.played > 0) t.modesPlayed += 1;
    });
    t.winRate = t.played ? t.won / t.played : null;
    t.accuracy = t.played ? t.accSum / t.played : null;
    return t;
  }

  /** Merged history across modes (or for one mode), oldest first, last n. */
  function recent(mode, n) {
    var all = storage.state.stats;
    var list = [];
    Object.keys(all).forEach(function (m) {
      if (mode && m !== mode) return;
      all[m].history.forEach(function (h) { list.push(Object.assign({ mode: m }, h)); });
    });
    list.sort(function (a, b) { return a.t - b.t; });
    return list.slice(-(n || 30));
  }

  App3.systems.stats = { record: record, summary: summary, overall: overall, recent: recent, ensure: ensure };
})(window.App3);
