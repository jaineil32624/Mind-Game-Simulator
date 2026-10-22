/**
 * App3.systems.hints — limited, XP-costing hints.
 *
 * The system owns the economy (how many hints, what they cost); each game
 * owns the content via getHint(), which returns { text } and may also
 * apply the hint to the board (e.g. reveal a Sudoku cell).
 */
(function (App3) {
  'use strict';

  var storage = App3.core.storage;
  var events = App3.core.events;

  var LIMITS = { easy: 3, medium: 3, hard: 2, expert: 1 };
  var COSTS = { easy: 5, medium: 10, hard: 15, expert: 20 };

  function limitFor(d) { return LIMITS[d] !== undefined ? LIMITS[d] : 2; }
  function costFor(d) { return COSTS[d] !== undefined ? COSTS[d] : 10; }
  function remaining(game) { return Math.max(0, limitFor(game.difficulty) - game.hintsUsed); }

  /**
   * Ask the game for a hint, enforcing limits and charging XP.
   * @returns {{ok:boolean, message:string, cost?:number}}
   */
  function request(game) {
    if (!game || game.finished) return { ok: false, message: 'This puzzle is already finished.' };
    if (remaining(game) <= 0) return { ok: false, message: 'No hints left for this puzzle.' };
    var hint = null;
    try { hint = game.getHint(); } catch (e) { console.error(e); hint = null; }
    if (!hint) return { ok: false, message: 'No hint available right now — try making a move first.' };
    game.hintsUsed += 1;
    var spent = App3.systems.xp.spend(costFor(game.difficulty));
    storage.state.counters.hintsUsed = (storage.state.counters.hintsUsed || 0) + 1;
    storage.save();
    App3.core.audio.play('hint');
    events.emit('hint:used', { mode: game.constructor.meta && game.constructor.meta.id, cost: spent });
    return { ok: true, message: hint.text, cost: spent };
  }

  App3.systems.hints = {
    LIMITS: LIMITS, COSTS: COSTS,
    limitFor: limitFor, costFor: costFor, remaining: remaining, request: request
  };
})(window.App3);
