/**
 * App3.games.registry — central list of playable game modes.
 *
 * Adding a mode = write a BaseGame subclass with static `meta`, then call
 * App3.games.registry.register(MyGame) at the bottom of its file and add
 * the <script> tag to index.html. Home, stats, daily challenges, leaderboard
 * and achievements pick it up automatically.
 */
(function (App3) {
  'use strict';

  var games = {};
  var order = [];

  var REQUIRED_META = ['id', 'name', 'description', 'icon'];

  var Registry = {
    /** Register a BaseGame subclass. */
    register: function (GameClass) {
      var meta = GameClass && GameClass.meta;
      if (!meta) throw new Error('Game class is missing static meta.');
      REQUIRED_META.forEach(function (k) {
        if (!meta[k]) throw new Error('Game meta missing "' + k + '".');
      });
      if (!(GameClass.prototype instanceof App3.games.BaseGame)) {
        throw new Error('Game "' + meta.id + '" must extend App3.games.BaseGame.');
      }
      if (!games[meta.id]) order.push(meta.id);
      games[meta.id] = GameClass;
      return GameClass;
    },

    get: function (id) { return games[id] || null; },

    has: function (id) { return !!games[id]; },

    /** Game classes in registration (display) order. */
    list: function () { return order.map(function (id) { return games[id]; }); },

    /** Ids sorted alphabetically — stable ordering for seeded daily picks. */
    ids: function () { return order.slice().sort(); },

    meta: function (id) { return games[id] ? games[id].meta : null; }
  };

  App3.games.registry = Registry;
})(window.App3);
