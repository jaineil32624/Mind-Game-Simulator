/**
 * Logic Grid Puzzle (Einstein-style) — generator, constraint solver and view.
 *
 * Generator:
 *   1. Pick N categories × M items (category 0 = names) and a random hidden
 *      solution: each other category is a permutation entity -> item.
 *   2. Repeatedly add a random TRUE clue (same / not / either-or / more-than /
 *      exactly-one-step) until the solver reports exactly one solution.
 *   3. Hard/Expert: drop every clue that is redundant (uniqueness still holds),
 *      producing a minimal, tighter clue set.
 *
 * Solver: assigns categories one at a time, iterating all M! permutations
 * per category and pruning with every clue whose categories are all assigned.
 * It counts solutions up to a limit (2 is enough to test uniqueness).
 *
 * View: classic staircase grid with ✗/✓ marking (click cycles, right-click
 * toggles ✗), optional auto-✗, clue list you can strike through.
 */
(function (App3) {
  'use strict';

  var BaseGame = App3.games.BaseGame;
  var utils = App3.core.utils;
  var el = utils.el;

  // ------------------------------------------------------------------ data

  var NAMES = ['Alice', 'Ben', 'Cara', 'Dev', 'Ella', 'Finn', 'Gia', 'Hugo', 'Iris', 'Jay'];

  var BANK = [
    { id: 'pet', name: 'Pet', items: ['Cat', 'Dog', 'Parrot', 'Rabbit', 'Turtle', 'Hamster'],
      ref: function (x) { return 'the ' + x.toLowerCase() + ' owner'; } },
    { id: 'color', name: 'Colour', items: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
      ref: function (x) { return 'the person who likes ' + x.toLowerCase(); } },
    { id: 'drink', name: 'Drink', items: ['Tea', 'Coffee', 'Juice', 'Milk', 'Cocoa', 'Water'],
      ref: function (x) { return 'the ' + x.toLowerCase() + ' drinker'; } },
    { id: 'city', name: 'City', items: ['Paris', 'Tokyo', 'Cairo', 'Lima', 'Oslo', 'Delhi'],
      ref: function (x) { return 'the person from ' + x; } },
    { id: 'hobby', name: 'Hobby', items: ['Chess', 'Painting', 'Running', 'Gardening', 'Cooking', 'Music'],
      ref: function (x) { return 'the ' + x.toLowerCase() + ' fan'; } }
  ];

  /** Ordered categories enable comparison clues. Values are ascending. */
  var ORDERED = [
    { id: 'age', name: 'Age', values: [21, 24, 27, 30, 33, 36],
      label: function (v) { return String(v); },
      ref: function (v) { return 'the ' + v + '-year-old'; },
      more: 'is older than', next: 'is exactly 3 years older than' },
    { id: 'floor', name: 'Floor', values: [1, 2, 3, 4, 5, 6],
      label: function (v) { return ['1st', '2nd', '3rd', '4th', '5th', '6th'][v - 1]; },
      ref: function (v) { return 'the person on floor ' + v; },
      more: 'lives on a higher floor than', next: 'lives exactly one floor above' },
    { id: 'price', name: 'Paid', values: [10, 20, 30, 40, 50, 60],
      label: function (v) { return '$' + v; },
      ref: function (v) { return 'the person who paid $' + v; },
      more: 'paid more than', next: 'paid exactly $10 more than' }
  ];

  var CFG = {
    easy:   { cats: 3, items: 3, ordered: 0,   minimize: false, weights: { same: 4, diff: 3, either: 1, more: 0, next: 0 } },
    medium: { cats: 3, items: 4, ordered: 0.5, minimize: false, weights: { same: 3, diff: 3, either: 2, more: 2, next: 1 } },
    hard:   { cats: 4, items: 4, ordered: 0.7, minimize: true,  weights: { same: 2, diff: 3, either: 2, more: 2, next: 2 } },
    expert: { cats: 4, items: 5, ordered: 1,   minimize: true,  weights: { same: 1, diff: 3, either: 3, more: 3, next: 2 } }
  };

  // ---------------------------------------------------------------- solver

  var PERM_CACHE = {};
  /** All permutations of 0..n-1 with precomputed inverses. */
  function permutations(n) {
    if (PERM_CACHE[n]) return PERM_CACHE[n];
    var out = [];
    (function rec(prefix, rest) {
      if (!rest.length) { out.push(prefix); return; }
      for (var i = 0; i < rest.length; i++) rec(prefix.concat(rest[i]), rest.slice(0, i).concat(rest.slice(i + 1)));
    })([], utils.range(n));
    var withInv = out.map(function (p) {
      var inv = new Array(n);
      p.forEach(function (item, e) { inv[item] = e; });
      return { p: p, inv: inv };
    });
    PERM_CACHE[n] = withInv;
    return withInv;
  }

  function clueCats(cl) {
    var cs = [cl.a.c, cl.b.c];
    if (cl.c) cs.push(cl.c.c);
    if (cl.o !== undefined) cs.push(cl.o);
    return cs;
  }

  /**
   * Count solutions (up to `limit`) of a puzzle.
   * @param {number} N categories, {number} M items, {Array} clues
   * @returns {{count:number, solution:number[][]|null}} solution[c][entity] = item
   */
  function countSolutions(N, M, clues, limit) {
    limit = limit || 2;
    var perms = permutations(M);
    var identity = utils.range(M);
    var assign = [identity], inv = [identity];
    var levels = [];
    for (var c = 0; c < N; c++) levels.push([]);
    clues.forEach(function (cl) { levels[Math.max.apply(null, clueCats(cl))].push(cl); });

    function ent(ref) { return inv[ref.c][ref.i]; }
    function holds(cl) {
      switch (cl.type) {
        case 'same': return ent(cl.a) === ent(cl.b);
        case 'diff': return ent(cl.a) !== ent(cl.b);
        case 'either': var e = ent(cl.a); return e === ent(cl.b) || e === ent(cl.c);
        case 'more': return assign[cl.o][ent(cl.a)] > assign[cl.o][ent(cl.b)];
        case 'next': return assign[cl.o][ent(cl.a)] === assign[cl.o][ent(cl.b)] + 1;
        default: return false;
      }
    }

    var count = 0, first = null;
    function rec(cat) {
      if (cat === N) {
        count++;
        if (!first) first = assign.map(function (a) { return a.slice(); });
        return count >= limit;
      }
      var lv = levels[cat];
      for (var k = 0; k < perms.length; k++) {
        assign[cat] = perms[k].p;
        inv[cat] = perms[k].inv;
        var ok = true;
        for (var j = 0; j < lv.length; j++) { if (!holds(lv[j])) { ok = false; break; } }
        if (ok && rec(cat + 1)) return true;
      }
      return false;
    }
    if (N <= 1) return { count: 1, solution: [identity] };
    rec(1);
    return { count: count, solution: first };
  }

  // ------------------------------------------------------------- generator

  function buildCategories(rng, cfg) {
    var M = cfg.items;
    var cats = [{ id: 'name', name: 'Name', items: rng.sample(NAMES, M).sort(), ordered: false, ref: function (x) { return x; } }];
    var useOrdered = cfg.ordered > 0 && rng.chance(cfg.ordered);
    var plain = cfg.cats - 1 - (useOrdered ? 1 : 0);
    rng.sample(BANK, plain).forEach(function (b) {
      cats.push({ id: b.id, name: b.name, items: rng.sample(b.items, M), ordered: false, ref: b.ref });
    });
    if (useOrdered) {
      var o = rng.pick(ORDERED);
      var vals = o.values.slice(0, M);
      cats.push({
        id: o.id, name: o.name, ordered: true, values: vals,
        items: vals.map(o.label), ref: null, refValue: o.ref, more: o.more, next: o.next
      });
    }
    return cats;
  }

  function refText(cats, ref) {
    var cat = cats[ref.c];
    return cat.ordered ? cat.refValue(cat.values[ref.i]) : cat.ref(cat.items[ref.i]);
  }

  function clueText(cats, cl) {
    var A = refText(cats, cl.a), B = refText(cats, cl.b);
    switch (cl.type) {
      case 'same': return utils.capitalize(A) + ' is ' + B + '.';
      case 'diff': return utils.capitalize(A) + ' is not ' + B + '.';
      case 'either': return utils.capitalize(A) + ' is either ' + B + ' or ' + refText(cats, cl.c) + '.';
      case 'more': return utils.capitalize(A) + ' ' + cats[cl.o].more + ' ' + B + '.';
      case 'next': return utils.capitalize(A) + ' ' + cats[cl.o].next + ' ' + B + '.';
      default: return '';
    }
  }

  function clueKey(cl) {
    var parts = [cl.type, cl.a.c + ':' + cl.a.i, cl.b.c + ':' + cl.b.i];
    if (cl.c) parts.push(cl.c.c + ':' + cl.c.i);
    if (cl.type === 'same' || cl.type === 'diff') parts = [cl.type].concat(parts.slice(1).sort());
    return parts.join('/');
  }

  /** Make one random clue that is TRUE for `sol`. */
  function randomClue(rng, cats, sol, type) {
    var N = cats.length, M = cats[0].items.length;
    var ordIdx = cats.findIndex(function (c) { return c.ordered; });
    var allCats = utils.range(N);
    function ref(c, e) { return { c: c, i: sol[c][e] }; }
    function twoEntities() { var es = rng.sample(utils.range(M), 2); return es; }
    var pair, es;
    switch (type) {
      case 'same':
        pair = rng.sample(allCats, 2);
        var e = rng.int(0, M - 1);
        if (pair[1] === 0) pair.reverse(); // names read best first
        return { type: 'same', a: ref(pair[0], e), b: ref(pair[1], e) };
      case 'diff':
        pair = rng.sample(allCats, 2);
        if (pair[1] === 0) pair.reverse();
        es = twoEntities();
        return { type: 'diff', a: ref(pair[0], es[0]), b: ref(pair[1], es[1]) };
      case 'either':
        pair = rng.sample(allCats, 2);
        if (pair[1] === 0) pair.reverse();
        es = twoEntities();
        var opts = rng.shuffle([ref(pair[1], es[0]), ref(pair[1], es[1])]);
        return { type: 'either', a: ref(pair[0], es[0]), b: opts[0], c: opts[1] };
      case 'more':
      case 'next':
        if (ordIdx < 0) return null;
        var nonOrd = allCats.filter(function (c) { return c !== ordIdx; });
        var hi, lo;
        if (type === 'more') {
          es = twoEntities();
          hi = sol[ordIdx][es[0]] > sol[ordIdx][es[1]] ? es[0] : es[1];
          lo = hi === es[0] ? es[1] : es[0];
        } else {
          var rank = rng.int(1, M - 1);
          hi = sol[ordIdx].indexOf(rank);
          lo = sol[ordIdx].indexOf(rank - 1);
        }
        return { type: type, a: ref(rng.pick(nonOrd), hi), b: ref(rng.pick(nonOrd), lo), o: ordIdx };
      default:
        return null;
    }
  }

  /**
   * Generate a puzzle with a verified unique solution.
   * @returns {{cats, N, M, solution:number[][], clues:Array}}
   */
  function generate(rng, difficulty) {
    var cfg = CFG[difficulty] || CFG.easy;
    for (var attempt = 0; attempt < 20; attempt++) {
      var cats = buildCategories(rng, cfg);
      var N = cats.length, M = cfg.items;
      var sol = [utils.range(M)];
      for (var c = 1; c < N; c++) sol.push(rng.shuffled(utils.range(M)));
      var hasOrd = cats.some(function (x) { return x.ordered; });
      var weights = Object.assign({}, cfg.weights);
      if (!hasOrd) { weights.more = 0; weights.next = 0; }

      var clues = [], seen = {};
      var guard = 0;
      while (countSolutions(N, M, clues, 2).count !== 1 && guard++ < 300) {
        var cl = randomClue(rng, cats, sol, rng.weighted(weights));
        if (!cl) continue;
        var k = clueKey(cl);
        if (seen[k]) continue;
        seen[k] = true;
        clues.push(cl);
      }
      if (countSolutions(N, M, clues, 2).count !== 1) continue;

      if (cfg.minimize) {
        rng.shuffled(utils.range(clues.length)).forEach(function (idx) {
          var target = clues[idx];
          var without = clues.filter(function (x) { return x !== target; });
          if (countSolutions(N, M, without, 2).count === 1) clues = without;
        });
      }

      var check = countSolutions(N, M, clues, 2);
      if (check.count !== 1 || !sameSolution(check.solution, sol)) continue;

      rng.shuffle(clues);
      clues.forEach(function (x) { x.text = clueText(cats, x); });
      return { cats: cats, N: N, M: M, solution: sol, clues: clues };
    }
    throw new Error('Logic grid generation failed');
  }

  function sameSolution(a, b) {
    return a.length === b.length && a.every(function (row, c) { return row.join() === b[c].join(); });
  }

  /** Independent validation used by tests: unique and equal to the hidden solution. */
  function validate(p) {
    var r = countSolutions(p.N, p.M, p.clues, 2);
    return r.count === 1 && sameSolution(r.solution, p.solution);
  }

  var Engine = { generate: generate, countSolutions: countSolutions, validate: validate, clueText: clueText, CFG: CFG };

  // -------------------------------------------------------------------- view

  function pairKey(ca, ia, cb, ib) {
    if (ca > cb) { var t = ca; ca = cb; cb = t; t = ia; ia = ib; ib = t; }
    return ca + ':' + ia + '|' + cb + ':' + ib;
  }
  function parseKey(k) {
    var p = k.split('|').map(function (s) { return s.split(':').map(Number); });
    return { ca: p[0][0], ia: p[0][1], cb: p[1][0], ib: p[1][1] };
  }

  class LogicGridGame extends BaseGame {
    generate() {
      this.p = Engine.generate(this.rng, this.difficulty);
      var p = this.p;
      // inverse solution: invSol[c][item] = entity
      this.invSol = p.solution.map(function (perm) {
        var inv = new Array(p.M);
        perm.forEach(function (item, e) { inv[item] = e; });
        return inv;
      });
      this.marks = {};
      this.placed = 0;
      this.wrong = 0;
    }

    isTrue(ca, ia, cb, ib) { return this.invSol[ca][ia] === this.invSol[cb][ib]; }

    autoCross() {
      var s = App3.core.storage.state;
      return !s || s.settings.autoCross !== false;
    }

    render() {
      var self = this;
      var p = this.p;
      this.root.innerHTML = '';
      this.cellEls = {};

      var N = p.N, M = p.M, cats = p.cats;
      var colCats = utils.range(N).slice(1);
      var rowCats = [0];
      for (var rc = N - 1; rc >= 2; rc--) rowCats.push(rc);

      var table = el('table', { class: 'lg-table', role: 'grid', 'aria-label': 'Logic grid' });
      var thead = el('thead');
      var tr1 = el('tr', null, [el('th', { class: 'lg-corner', colspan: 2, rowspan: 2 })]);
      colCats.forEach(function (cc) { tr1.appendChild(el('th', { class: 'lg-cat', colspan: M }, cats[cc].name)); });
      var tr2 = el('tr');
      colCats.forEach(function (cc) {
        cats[cc].items.forEach(function (item, j) {
          tr2.appendChild(el('th', { class: 'lg-colhead' + (j === 0 ? ' gstart' : '') }, el('span', { class: 'vert' }, item)));
        });
      });
      thead.appendChild(tr1);
      thead.appendChild(tr2);
      table.appendChild(thead);

      var tbody = el('tbody');
      rowCats.forEach(function (rcat, g) {
        var shownCount = N - 1 - g;
        for (var i = 0; i < M; i++) {
          var tr = el('tr', { class: i === M - 1 ? 'gend' : '' });
          if (i === 0) tr.appendChild(el('th', { class: 'lg-cat-row', rowspan: M }, el('span', { class: 'vert' }, cats[rcat].name)));
          tr.appendChild(el('th', { class: 'lg-rowhead' }, cats[rcat].items[i]));
          colCats.forEach(function (cc, gi) {
            if (gi < shownCount) {
              for (var j = 0; j < M; j++) {
                var key = pairKey(rcat, i, cc, j);
                var td = el('td', { class: 'lg-cell' + (j === 0 ? ' gstart' : ''), dataset: { key: key }, tabindex: -1,
                  'aria-label': cats[rcat].items[i] + ' / ' + cats[cc].items[j] });
                self.cellEls[key] = td;
                tr.appendChild(td);
              }
            } else if (gi === shownCount) {
              tr.appendChild(el('td', { class: 'lg-void', colspan: M * (colCats.length - shownCount) }));
            }
          });
          tbody.appendChild(tr);
        }
      });
      table.appendChild(tbody);

      this.listen(table, 'click', function (e) {
        var td = e.target.closest('.lg-cell');
        if (!td) return;
        var cur = self.marks[td.dataset.key] || 0;
        self.setMark(td.dataset.key, (cur + 1) % 3, true);
      });
      this.listen(table, 'contextmenu', function (e) {
        var td = e.target.closest('.lg-cell');
        if (!td) return;
        e.preventDefault();
        var cur = self.marks[td.dataset.key] || 0;
        self.setMark(td.dataset.key, cur === 1 ? 0 : 1, true);
      });

      var clueList = el('ol', { class: 'lg-clues' });
      p.clues.forEach(function (cl) {
        var li = el('li', { tabindex: 0, title: 'Click to strike through' }, cl.text);
        li.addEventListener('click', function () { li.classList.toggle('used'); });
        li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.classList.toggle('used'); } });
        clueList.appendChild(li);
      });

      var auto = el('input', { type: 'checkbox', id: 'lg-auto' });
      auto.checked = this.autoCross();
      auto.addEventListener('change', function () {
        App3.core.storage.state.settings.autoCross = auto.checked;
        App3.core.storage.save();
      });

      this.statusEl = el('div', { class: 'lg-status muted' });
      this.root.appendChild(el('div', { class: 'lg-wrap' }, [
        el('div', { class: 'lg-grid-scroll' }, table),
        el('aside', { class: 'lg-side card' }, [
          el('h3', null, 'Clues'),
          clueList,
          el('div', { class: 'lg-controls' }, [
            el('label', { class: 'switch-label', for: 'lg-auto' }, [auto, ' Auto-✗ after ✓']),
            el('button', { class: 'btn small ghost', type: 'button', onclick: function () { self.clearMarks(); } }, 'Clear grid')
          ]),
          el('p', { class: 'muted small' }, 'Click a cell: blank → ✗ → ✓. Right-click toggles ✗. Fill every Name pairing with ✓ to solve.'),
          this.statusEl
        ])
      ]));
      this.updateStatus();
    }

    paint(key) {
      var td = this.cellEls[key];
      if (!td) return;
      var v = this.marks[key] || 0;
      td.textContent = v === 2 ? '✓' : v === 1 ? '✗' : '';
      td.classList.toggle('yes', v === 2);
      td.classList.toggle('no', v === 1);
    }

    /** Set a mark. `user` marks count for accuracy; auto/hint marks don't. */
    setMark(key, value, user) {
      if (this.finished) return;
      var k = parseKey(key);
      this.marks[key] = value;
      if (user && value) {
        this.placed += 1;
        var truth = this.isTrue(k.ca, k.ia, k.cb, k.ib);
        if ((value === 2 && !truth) || (value === 1 && truth)) this.wrong += 1;
        this.sound('click');
      }
      this.paint(key);
      if (value === 2 && this.autoCross()) {
        for (var x = 0; x < this.p.M; x++) {
          if (x !== k.ib) this.autoX(pairKey(k.ca, k.ia, k.cb, x));
          if (x !== k.ia) this.autoX(pairKey(k.ca, x, k.cb, k.ib));
        }
      }
      this.updateStatus();
      this.checkWin();
    }

    autoX(key) { if (!this.marks[key]) { this.marks[key] = 1; this.paint(key); } }

    clearMarks() {
      if (this.finished) return;
      this.marks = {};
      var self = this;
      Object.keys(this.cellEls).forEach(function (k) { self.paint(k); });
      this.updateStatus();
    }

    updateStatus() {
      var p = this.p, done = 0;
      for (var c = 1; c < p.N; c++) {
        for (var e = 0; e < p.M; e++) if (this.marks[pairKey(0, e, c, p.solution[c][e])] === 2) done++;
      }
      var yes = 0;
      var self = this;
      Object.keys(this.marks).forEach(function (k) { if (self.marks[k] === 2) yes++; });
      this.statusEl.textContent = yes + ' ✓ placed';
      return done;
    }

    checkWin() {
      var p = this.p;
      for (var c = 1; c < p.N; c++) {
        for (var e = 0; e < p.M; e++) {
          for (var j = 0; j < p.M; j++) {
            var want = p.solution[c][e] === j;
            var isYes = this.marks[pairKey(0, e, c, j)] === 2;
            if (want !== isYes) return;
          }
        }
      }
      var acc = this.placed ? 1 - this.wrong / this.placed : 1;
      this.root.querySelector('.lg-table').classList.add('solved');
      this.sound('win');
      this.complete({ won: true, accuracy: acc, delay: 900 });
    }

    flash(key) {
      var td = this.cellEls[key];
      if (!td) return;
      td.classList.remove('flash');
      void td.offsetWidth;
      td.classList.add('flash');
    }

    getHint() {
      var p = this.p, self = this;
      var cats = p.cats;
      function name(c, i) { return cats[c].items[i]; }
      // 1) Fix a wrong mark.
      var keys = Object.keys(this.marks);
      for (var n = 0; n < keys.length; n++) {
        var k = parseKey(keys[n]), v = this.marks[keys[n]];
        if (!v) continue;
        var truth = this.isTrue(k.ca, k.ia, k.cb, k.ib);
        if ((v === 2 && !truth) || (v === 1 && truth)) {
          this.marks[keys[n]] = 0;
          this.paint(keys[n]);
          this.flash(keys[n]);
          return { text: 'The mark for ' + name(k.ca, k.ia) + ' / ' + name(k.cb, k.ib) + ' was wrong — it has been cleared.' };
        }
      }
      // 2) Apply a direct clue that isn't on the grid yet.
      for (var ci = 0; ci < p.clues.length; ci++) {
        var cl = p.clues[ci];
        if (cl.type !== 'same' && cl.type !== 'diff') continue;
        var key = pairKey(cl.a.c, cl.a.i, cl.b.c, cl.b.i);
        var want = cl.type === 'same' ? 2 : 1;
        if (this.marks[key] !== want) {
          this.setMark(key, want, false);
          this.flash(key);
          return { text: 'Clue ' + (ci + 1) + ' tells you directly: ' + cl.text };
        }
      }
      // 3) Reveal a Name pairing.
      for (var c = 1; c < p.N; c++) {
        for (var e = 0; e < p.M; e++) {
          var kk = pairKey(0, e, c, p.solution[c][e]);
          if (this.marks[kk] !== 2) {
            this.setMark(kk, 2, false);
            this.flash(kk);
            return { text: 'Deduction: ' + name(0, e) + ' goes with ' + name(c, p.solution[c][e]) + '.' };
          }
        }
      }
      return null;
    }
  }

  LogicGridGame.meta = {
    id: 'logic',
    name: 'Logic Grid',
    description: 'Einstein-style deduction: use the clues to match every person with their attributes.',
    icon: '🧩',
    color: '#14b8a6',
    parTime: { easy: 180, medium: 360, hard: 720, expert: 1200 },
    difficultyInfo: { easy: '3 × 3', medium: '3 × 4', hard: '4 × 4, minimal clues', expert: '4 × 5, minimal clues' }
  };
  LogicGridGame.engine = Engine;

  App3.games.LogicGridGame = LogicGridGame;
  App3.games.registry.register(LogicGridGame);
})(window.App3);
