/**
 * App3.systems.achievements — badge definitions and unlock evaluation.
 *
 * Each definition has a `check(ctx)` predicate. ctx = { state, result?, level }
 * where `result` is the most recent finished puzzle (if any). evaluate() is
 * called after puzzles, level-ups and daily completions; newly unlocked
 * badges emit `achievement:unlocked` (the UI shows an animated toast) and
 * grant a small XP bonus.
 *
 * To add a badge just append to DEFS — ids must stay stable (they are saved).
 */
(function (App3) {
  'use strict';

  var storage = App3.core.storage;
  var events = App3.core.events;
  var ACHIEVEMENT_XP = 25;

  function modeStats(state, id) { return state.stats[id] || { played: 0, won: 0 }; }
  function wonMode(r, mode, minDiff) {
    if (!r || !r.won || r.mode !== mode) return false;
    if (!minDiff) return true;
    return App3.DIFFICULTIES.indexOf(r.difficulty) >= App3.DIFFICULTIES.indexOf(minDiff);
  }
  function perfect(r, mode) { return !!(r && r.won && r.mode === mode && r.accuracy >= 0.999); }

  var DEFS = [
    { id: 'first_win', icon: '🌟', name: 'First Steps', desc: 'Win your first puzzle.',
      check: function (c) { return (c.state.counters.totalWon || 0) >= 1; } },
    { id: 'sudoku_solver', icon: '🔢', name: 'Grid Runner', desc: 'Solve a Sudoku.',
      check: function (c) { return modeStats(c.state, 'sudoku').won >= 1; } },
    { id: 'sudoku_expert', icon: '🧮', name: 'Sudoku Sensei', desc: 'Solve an Expert Sudoku.',
      check: function (c) { return wonMode(c.result, 'sudoku', 'expert'); } },
    { id: 'memory_perfect', icon: '🃏', name: 'Total Recall', desc: 'Win Memory Match with no avoidable mistakes.',
      check: function (c) { return perfect(c.result, 'memory'); } },
    { id: 'logician', icon: '🧩', name: 'Logician', desc: 'Solve a Logic Grid puzzle.',
      check: function (c) { return modeStats(c.state, 'logic').won >= 1; } },
    { id: 'logic_expert', icon: '🕵️', name: 'Master Detective', desc: 'Solve an Expert Logic Grid.',
      check: function (c) { return wonMode(c.result, 'logic', 'expert'); } },
    { id: 'pattern_perfect', icon: '🔷', name: 'Eagle Eye', desc: 'Get every question right in a Pattern round.',
      check: function (c) { return perfect(c.result, 'pattern'); } },
    { id: 'sequence_perfect', icon: '📈', name: 'Number Cruncher', desc: 'Get every question right in a Number Sequences round.',
      check: function (c) { return perfect(c.result, 'sequence'); } },
    { id: 'visual_perfect', icon: '🧠', name: 'Visual Genius', desc: 'Get every question right in a Visual IQ round.',
      check: function (c) { return perfect(c.result, 'visual'); } },
    { id: 'daily_first', icon: '📅', name: 'Daily Habit', desc: 'Complete a full daily challenge.',
      check: function (c) { return (c.state.daily.bestStreak || 0) >= 1; } },
    { id: 'streak_3', icon: '🔥', name: 'On Fire', desc: 'Reach a 3-day daily streak.',
      check: function (c) { return (c.state.daily.bestStreak || 0) >= 3; } },
    { id: 'streak_7', icon: '☄️', name: 'Unstoppable', desc: 'Reach a 7-day daily streak.',
      check: function (c) { return (c.state.daily.bestStreak || 0) >= 7; } },
    { id: 'level_5', icon: '⬆️', name: 'Rising Star', desc: 'Reach level 5.',
      check: function (c) { return c.level >= 5; } },
    { id: 'level_10', icon: '🚀', name: 'Big Brain', desc: 'Reach level 10.',
      check: function (c) { return c.level >= 10; } },
    { id: 'level_25', icon: '👑', name: 'Mastermind', desc: 'Reach level 25.',
      check: function (c) { return c.level >= 25; } },
    { id: 'speed_demon', icon: '⚡', name: 'Speed Demon', desc: 'Win a Medium or harder puzzle in under 60 seconds.',
      check: function (c) { var r = c.result; return !!(r && r.won && r.difficulty !== 'easy' && r.timeMs < 60000); } },
    { id: 'purist', icon: '🎯', name: 'Purist', desc: 'Win an Expert puzzle without using hints.',
      check: function (c) { var r = c.result; return !!(r && r.won && r.difficulty === 'expert' && r.hintsUsed === 0); } },
    { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'Play every game mode at least once.',
      check: function (c) {
        var ids = App3.games.registry.ids();
        return ids.length > 0 && ids.every(function (id) { return modeStats(c.state, id).played > 0; });
      } },
    { id: 'marathon', icon: '🏃', name: 'Marathon', desc: 'Win 25 puzzles.',
      check: function (c) { return (c.state.counters.totalWon || 0) >= 25; } },
    { id: 'centurion', icon: '💯', name: 'Centurion', desc: 'Play 100 puzzles.',
      check: function (c) { return (c.state.counters.totalPlayed || 0) >= 100; } },
    { id: 'night_owl', icon: '🦉', name: 'Night Owl', desc: 'Finish a puzzle between midnight and 4 AM.',
      check: function (c) { return !!c.result && new Date().getHours() < 4; } },
    { id: 'hint_free_10', icon: '🧘', name: 'Self-Reliant', desc: 'Win 10 puzzles without ever using a hint.',
      check: function (c) { return (c.state.counters.totalWon || 0) >= 10 && (c.state.counters.hintsUsed || 0) === 0; } }
  ];

  function isUnlocked(id) { return !!storage.state.achievements.unlocked[id]; }

  function unlock(def) {
    storage.state.achievements.unlocked[def.id] = Date.now();
    storage.save();
    events.emit('achievement:unlocked', { achievement: def });
  }

  /**
   * Check all locked badges. Unlocking grants XP, which may level up and
   * unlock more badges, so loop until stable.
   * @returns {Array} newly unlocked definitions
   */
  function evaluate(extra) {
    var newly = [];
    var guard = 0;
    var changed = true;
    while (changed && guard++ < 5) {
      var ctx = {
        state: storage.state,
        result: extra && extra.result,
        level: App3.systems.xp.current().level
      };
      var pass = 0;
      DEFS.forEach(function (def) {
        if (isUnlocked(def.id)) return;
        var ok = false;
        try { ok = def.check(ctx); } catch (e) { ok = false; }
        if (ok) {
          unlock(def);
          newly.push(def);
          pass += 1;
        }
      });
      changed = pass > 0;
      // Grant XP after the pass so level-based badges re-check next loop.
      if (changed) App3.systems.xp.award(pass * ACHIEVEMENT_XP, 'achievements');
    }
    return newly;
  }

  function list() {
    var unlocked = storage.state.achievements.unlocked;
    return DEFS.map(function (d) {
      return { id: d.id, icon: d.icon, name: d.name, desc: d.desc, unlockedAt: unlocked[d.id] || null };
    });
  }

  App3.systems.achievements = {
    DEFS: DEFS,
    XP_REWARD: ACHIEVEMENT_XP,
    evaluate: evaluate,
    list: list,
    isUnlocked: isUnlocked,
    count: function () { return Object.keys(storage.state.achievements.unlocked).length; },
    total: function () { return DEFS.length; }
  };
})(window.App3);
