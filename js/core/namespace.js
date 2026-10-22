/**
 * App3 — namespace bootstrap.
 *
 * Every script in the project is a classic <script> (no ES modules) so the
 * app works when index.html is opened straight from disk (file://).
 * Each file attaches its exports to the single global `window.App3`.
 *
 *   App3.core     low-level utilities (rng, events, storage, audio, utils)
 *   App3.systems  meta-game systems (xp, achievements, stats, daily, ...)
 *   App3.games    BaseGame, registry, and one class per game mode
 *   App3.ui       router, components, toasts, charts and screens
 */
(function (global) {
  'use strict';

  var App3 = global.App3 || {};

  App3.VERSION = '1.0.0';
  App3.core = App3.core || {};
  App3.systems = App3.systems || {};
  App3.games = App3.games || {};
  App3.ui = App3.ui || {};
  App3.ui.screens = App3.ui.screens || {};

  global.App3 = App3;
})(typeof window !== 'undefined' ? window : globalThis);
