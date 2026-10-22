/**
 * App3.core.storage — versioned save system on top of localStorage.
 *
 *  - The whole save is one JSON document under KEY.
 *  - Every save carries `version`. When the schema changes, bump VERSION and
 *    add a migration MIGRATIONS[oldVersion] that upgrades to oldVersion + 1.
 *    Migrations run in sequence, then the result is deep-merged onto fresh
 *    defaults so newly introduced fields always exist.
 *  - Export/import uses the same pipeline, so old exported files still load.
 *  - If localStorage is unavailable (privacy mode, some file:// setups) an
 *    in-memory fallback keeps the app working for the session.
 */
(function (App3) {
  'use strict';

  var utils = App3.core.utils;
  var events = App3.core.events;

  var KEY = 'app3.save';
  var VERSION = 3;

  /** Fresh save document for the current schema version. */
  function defaults() {
    return {
      version: VERSION,
      createdAt: Date.now(),
      profile: { name: 'Player', xp: 0, xpHistory: [] },
      settings: { theme: 'auto', muted: false, autoCross: true },
      stats: {},                       // modeId -> per-mode stats (see systems/stats.js)
      progress: {},                    // modeId -> { difficulty -> puzzles won }
      achievements: { unlocked: {} },  // id -> unlock timestamp
      daily: { completed: {}, streak: 0, bestStreak: 0, lastDate: null },
      counters: { hintsUsed: 0, totalPlayed: 0, totalWon: 0 },
      leaderboard: { entries: [] }
    };
  }

  /**
   * Schema migrations. Key = version being upgraded FROM.
   *   v1 (prototype): flat { xp, playerName, stats, achievements }
   *   v2: profile object introduced
   *   v3: leaderboard, counters and settings.autoCross added
   */
  var MIGRATIONS = {
    1: function (s) {
      s.profile = s.profile || {
        name: typeof s.playerName === 'string' ? s.playerName : 'Player',
        xp: typeof s.xp === 'number' ? s.xp : 0,
        xpHistory: []
      };
      delete s.xp;
      delete s.playerName;
      return s;
    },
    2: function (s) {
      s.leaderboard = s.leaderboard || { entries: [] };
      s.counters = s.counters || { hintsUsed: 0, totalPlayed: 0, totalWon: 0 };
      s.settings = s.settings || {};
      if (s.settings.autoCross === undefined) s.settings.autoCross = true;
      return s;
    }
  };

  /** Upgrade any supported save object to the current schema. Throws on invalid input. */
  function migrate(raw) {
    if (!utils.isPlainObject(raw)) throw new Error('Save data must be a JSON object.');
    var s = utils.clone(raw);
    var v = typeof s.version === 'number' ? Math.floor(s.version) : 1;
    if (v > VERSION) throw new Error('This save was created by a newer version of App3 (v' + v + ').');
    if (v < 1) throw new Error('Unknown save version.');
    while (v < VERSION) {
      var step = MIGRATIONS[v];
      if (!step) throw new Error('No migration path from save version ' + v + '.');
      s = step(s) || s;
      v += 1;
      s.version = v;
    }
    var merged = utils.deepMerge(defaults(), s);
    merged.version = VERSION;
    // Basic sanity on critical numeric fields.
    if (typeof merged.profile.xp !== 'number' || !isFinite(merged.profile.xp) || merged.profile.xp < 0) merged.profile.xp = 0;
    return merged;
  }

  var memoryStore = {};
  var memoryBackend = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(memoryStore, k) ? memoryStore[k] : null; },
    setItem: function (k, v) { memoryStore[k] = String(v); },
    removeItem: function (k) { delete memoryStore[k]; }
  };
  var cachedBackend = null;

  /** Resolve localStorage lazily, falling back to memory. */
  function backend() {
    if (cachedBackend) return cachedBackend;
    try {
      var ls = window.localStorage;
      var probe = '__app3_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      cachedBackend = ls;
      Storage.persistent = true;
    } catch (e) {
      cachedBackend = memoryBackend;
      Storage.persistent = false;
    }
    return cachedBackend;
  }

  var Storage = {
    KEY: KEY,
    VERSION: VERSION,
    /** Live save document. Systems mutate it then call save(). */
    state: null,
    persistent: true,
    defaults: defaults,
    migrate: migrate,

    load: function () {
      var raw = null;
      try {
        var txt = backend().getItem(KEY);
        if (txt) raw = JSON.parse(txt);
      } catch (e) {
        console.warn('[App3] Could not read save, starting fresh.', e);
      }
      try {
        this.state = raw ? migrate(raw) : defaults();
      } catch (e2) {
        console.warn('[App3] Save could not be migrated, starting fresh.', e2);
        try { backend().setItem(KEY + '.corrupt', JSON.stringify(raw)); } catch (e3) { /* ignore */ }
        this.state = defaults();
      }
      this.save();
      return this.state;
    },

    save: function () {
      if (!this.state) return;
      try { backend().setItem(KEY, JSON.stringify(this.state)); }
      catch (e) { console.warn('[App3] Save failed (storage full or unavailable).', e); }
    },

    /** Mutate + persist in one call. */
    update: function (fn) { fn(this.state); this.save(); },

    /** Serialized export envelope. */
    exportJSON: function () {
      return JSON.stringify({ app: 'App3', exportedAt: new Date().toISOString(), data: this.state }, null, 2);
    },

    /** Replace the save from an export file (or a raw save object). Throws on invalid input. */
    importJSON: function (text) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { throw new Error('File is not valid JSON.'); }
      var data = (parsed && parsed.app === 'App3' && parsed.data) ? parsed.data : parsed;
      this.state = migrate(data);
      this.save();
      events.emit('storage:replaced');
      return this.state;
    },

    /** Wipe all progress (keeps nothing). */
    reset: function () {
      this.state = defaults();
      this.save();
      events.emit('storage:replaced');
    }
  };

  App3.core.storage = Storage;
})(window.App3);
