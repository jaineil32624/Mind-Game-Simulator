/**
 * App3.core.events — a minimal publish/subscribe bus that decouples systems.
 *
 * Common events:
 *   xp:changed            { amount, info }
 *   level:up              { from, to }
 *   achievement:unlocked  { achievement }
 *   game:completed        { result }
 *   daily:completed       { date, streak }
 *   hint:used             { mode, cost }
 *   storage:replaced      (after import / reset)
 *   settings:changed      { key, value }
 */
(function (App3) {
  'use strict';

  function EventBus() { this._handlers = {}; }

  /** Subscribe; returns an unsubscribe function. */
  EventBus.prototype.on = function (type, handler) {
    (this._handlers[type] = this._handlers[type] || []).push(handler);
    var self = this;
    return function () { self.off(type, handler); };
  };

  EventBus.prototype.once = function (type, handler) {
    var off = this.on(type, function (payload) { off(); handler(payload); });
    return off;
  };

  EventBus.prototype.off = function (type, handler) {
    var list = this._handlers[type];
    if (!list) return;
    var i = list.indexOf(handler);
    if (i >= 0) list.splice(i, 1);
  };

  /** Emit synchronously; a throwing handler never breaks the others. */
  EventBus.prototype.emit = function (type, payload) {
    var list = (this._handlers[type] || []).slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { if (typeof console !== 'undefined') console.error('[App3 event:' + type + ']', e); }
    }
  };

  App3.core.EventBus = EventBus;
  App3.core.events = new EventBus();
})(window.App3);
