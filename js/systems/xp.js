/**
 * App3.systems.xp — experience points and level progression.
 *
 * Level curve: XP needed to go from level L to L+1 is
 *     round(80 + 45 * (L - 1)^1.3)
 * L1->2: 80, L5->6: ~355, L10->11: ~800, L20->21: ~1870. Unlimited levels.
 */
(function (App3) {
  'use strict';

  var storage = App3.core.storage;
  var events = App3.core.events;
  var utils = App3.core.utils;

  /** Base XP for winning a puzzle at each difficulty. */
  var BASE_REWARD = { easy: 20, medium: 35, hard: 55, expert: 80 };
  var LOSS_REWARD = 5;
  var DAILY_MULTIPLIER = 2;

  function xpToNext(level) {
    return Math.round(80 + 45 * Math.pow(Math.max(0, level - 1), 1.3));
  }

  /** Break a total XP amount into level + progress within the level. */
  function levelInfo(total) {
    total = Math.max(0, Math.floor(total || 0));
    var level = 1;
    var rem = total;
    var need = xpToNext(level);
    while (rem >= need) {
      rem -= need;
      level += 1;
      need = xpToNext(level);
    }
    return { level: level, into: rem, needed: need, total: total, progress: need ? rem / need : 0 };
  }

  function totalXp() { return storage.state.profile.xp; }

  /** Add XP; emits xp:changed and level:up. Returns before/after info. */
  function award(amount, reason) {
    amount = Math.max(0, Math.round(amount || 0));
    var before = levelInfo(totalXp());
    storage.state.profile.xp += amount;
    var hist = storage.state.profile.xpHistory;
    hist.push({ t: Date.now(), xp: amount, reason: reason || '' });
    if (hist.length > 200) hist.splice(0, hist.length - 200);
    storage.save();
    var after = levelInfo(totalXp());
    events.emit('xp:changed', { amount: amount, info: after });
    if (after.level > before.level) events.emit('level:up', { from: before.level, to: after.level });
    return { amount: amount, before: before, after: after, leveledUp: after.level > before.level };
  }

  /**
   * Spend XP (e.g. on hints). Never drops the player below the start of
   * their current level, so hints cannot cause a de-level. Returns XP spent.
   */
  function spend(amount) {
    var info = levelInfo(totalXp());
    var spendable = info.into;
    var actual = Math.max(0, Math.min(amount, spendable));
    storage.state.profile.xp -= actual;
    storage.save();
    events.emit('xp:changed', { amount: -actual, info: levelInfo(totalXp()) });
    return actual;
  }

  /**
   * XP reward breakdown for a finished puzzle.
   * @param {object} r     result { won, difficulty, accuracy, timeMs, daily }
   * @param {object} meta  game meta (for parTime)
   */
  function computeReward(r, meta) {
    var parts = [];
    if (!r.won) {
      parts.push({ label: 'Participation', xp: LOSS_REWARD });
      return { total: LOSS_REWARD, parts: parts };
    }
    var base = BASE_REWARD[r.difficulty] || BASE_REWARD.easy;
    parts.push({ label: 'Solved (' + (App3.DIFFICULTY_LABELS[r.difficulty] || r.difficulty) + ')', xp: base });

    var acc = utils.clamp(r.accuracy, 0, 1);
    var accXp = Math.round(base * 0.5 * acc);
    if (accXp > 0) parts.push({ label: 'Accuracy ' + Math.round(acc * 100) + '%', xp: accXp });

    var par = meta && meta.parTime && meta.parTime[r.difficulty];
    if (par) {
      var parMs = par * 1000;
      var speedXp = Math.round(base * 0.5 * utils.clamp((parMs - r.timeMs) / parMs, 0, 1));
      if (speedXp > 0) parts.push({ label: 'Speed bonus', xp: speedXp });
    }

    var total = parts.reduce(function (s, p) { return s + p.xp; }, 0);
    if (r.daily) {
      parts.push({ label: 'Daily challenge ×' + DAILY_MULTIPLIER, xp: total * (DAILY_MULTIPLIER - 1) });
      total *= DAILY_MULTIPLIER;
    }
    return { total: total, parts: parts };
  }

  App3.systems.xp = {
    BASE_REWARD: BASE_REWARD,
    xpToNext: xpToNext,
    levelInfo: levelInfo,
    award: award,
    spend: spend,
    computeReward: computeReward,
    current: function () { return levelInfo(totalXp()); }
  };
})(window.App3);
