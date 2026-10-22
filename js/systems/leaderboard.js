/**
 * App3.systems.leaderboard — pluggable leaderboard framework.
 *
 *   LeaderboardProvider        abstract interface (Promise-based so remote
 *                              implementations fit without UI changes)
 *   LocalLeaderboardProvider   personal bests stored in the save file
 *   RemoteLeaderboardProvider  stub showing where an HTTP backend plugs in
 *
 * Swap providers at runtime: App3.systems.leaderboard.setProvider(p).
 *
 * Entry shape:
 *   { id, name, mode, difficulty, score, timeMs, accuracy, hintsUsed, date, daily }
 */
(function (App3) {
  'use strict';

  var storage = App3.core.storage;
  var MAX_PER_BOARD = 25;
  var DIFF_MULT = { easy: 1, medium: 1.6, hard: 2.4, expert: 3.5 };

  /** Abstract base — every method returns a Promise. */
  class LeaderboardProvider {
    get id() { return 'abstract'; }
    get label() { return 'Abstract provider'; }
    /** @returns {Promise<{rank:number}>} */
    submit(/* entry */) { return Promise.reject(new Error('submit() not implemented')); }
    /** @returns {Promise<Array>} best entries for a board, highest score first */
    top(/* mode, difficulty, limit */) { return Promise.reject(new Error('top() not implemented')); }
    /** @returns {Promise<void>} */
    clear() { return Promise.resolve(); }
  }

  /** Stores the top entries per (mode, difficulty) board in localStorage. */
  class LocalLeaderboardProvider extends LeaderboardProvider {
    get id() { return 'local'; }
    get label() { return 'This device'; }

    _entries() { return storage.state.leaderboard.entries; }

    submit(entry) {
      var list = this._entries();
      var e = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }, entry);
      list.push(e);
      // Keep only the best MAX_PER_BOARD entries for this board.
      var board = list.filter(function (x) { return x.mode === e.mode && x.difficulty === e.difficulty; })
        .sort(compare);
      var drop = board.slice(MAX_PER_BOARD).map(function (x) { return x.id; });
      if (drop.length) {
        storage.state.leaderboard.entries = list.filter(function (x) { return drop.indexOf(x.id) < 0; });
      }
      storage.save();
      var rank = board.findIndex(function (x) { return x.id === e.id; }) + 1;
      return Promise.resolve({ rank: rank > 0 && rank <= MAX_PER_BOARD ? rank : null });
    }

    top(mode, difficulty, limit) {
      var list = this._entries().filter(function (x) {
        return (!mode || x.mode === mode) && (!difficulty || x.difficulty === difficulty);
      }).sort(compare);
      return Promise.resolve(list.slice(0, limit || 10));
    }

    clear() {
      storage.state.leaderboard.entries = [];
      storage.save();
      return Promise.resolve();
    }
  }

  /**
   * Remote provider STUB. A real backend would expose e.g.
   *   POST {endpoint}/scores            body: entry            -> { rank }
   *   GET  {endpoint}/scores?mode=&difficulty=&limit=          -> [entries]
   * Authentication (apiKey / player token) goes in the headers. Scores should
   * be validated server-side (e.g. by re-checking the puzzle seed + solution).
   */
  class RemoteLeaderboardProvider extends LeaderboardProvider {
    constructor(config) {
      super();
      this.config = Object.assign({ endpoint: '', apiKey: '', timeoutMs: 8000 }, config || {});
    }
    get id() { return 'remote'; }
    get label() { return 'Global (online)'; }
    get configured() { return !!this.config.endpoint; }

    _request(path, init) {
      if (!this.configured) {
        return Promise.reject(new Error('Online leaderboard is not configured. Set an endpoint in RemoteLeaderboardProvider to enable it.'));
      }
      var headers = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) headers.Authorization = 'Bearer ' + this.config.apiKey;
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, this.config.timeoutMs) : null;
      return fetch(this.config.endpoint.replace(/\/$/, '') + path, Object.assign({ headers: headers, signal: ctrl && ctrl.signal }, init))
        .then(function (res) {
          if (timer) clearTimeout(timer);
          if (!res.ok) throw new Error('Leaderboard server responded ' + res.status);
          return res.json();
        });
    }

    submit(entry) {
      return this._request('/scores', { method: 'POST', body: JSON.stringify(entry) });
    }

    top(mode, difficulty, limit) {
      var q = '?mode=' + encodeURIComponent(mode || '') + '&difficulty=' + encodeURIComponent(difficulty || '') + '&limit=' + (limit || 10);
      return this._request('/scores' + q, { method: 'GET' });
    }
  }

  function compare(a, b) { return (b.score - a.score) || (a.timeMs - b.timeMs) || (a.date < b.date ? -1 : 1); }

  /** Score formula: difficulty-weighted, rewards accuracy and speed, penalizes hints. */
  function computeScore(r, meta) {
    var par = (meta && meta.parTime && meta.parTime[r.difficulty]) || 300;
    var speed = Math.max(0.25, Math.min(2, (par * 1000) / Math.max(1000, r.timeMs)));
    var acc = Math.max(0, Math.min(1, r.accuracy));
    var raw = 1000 * (DIFF_MULT[r.difficulty] || 1) * (0.5 + 0.5 * acc) * (0.6 + 0.4 * speed);
    return Math.max(0, Math.round(raw * Math.pow(0.85, r.hintsUsed || 0)));
  }

  var provider = new LocalLeaderboardProvider();

  App3.systems.leaderboard = {
    LeaderboardProvider: LeaderboardProvider,
    LocalLeaderboardProvider: LocalLeaderboardProvider,
    RemoteLeaderboardProvider: RemoteLeaderboardProvider,
    computeScore: computeScore,
    getProvider: function () { return provider; },
    setProvider: function (p) {
      if (!(p instanceof LeaderboardProvider)) throw new Error('Provider must extend LeaderboardProvider');
      provider = p;
    },
    /** Convenience: build an entry from a game result and submit it. */
    submitResult: function (r, meta) {
      var entry = {
        name: storage.state.profile.name || 'Player',
        mode: r.mode, difficulty: r.difficulty,
        score: computeScore(r, meta), timeMs: r.timeMs,
        accuracy: r.accuracy, hintsUsed: r.hintsUsed || 0,
        date: new Date().toISOString(), daily: !!r.daily
      };
      return provider.submit(entry).then(function (res) { return Object.assign({ score: entry.score }, res); });
    }
  };
})(window.App3);
