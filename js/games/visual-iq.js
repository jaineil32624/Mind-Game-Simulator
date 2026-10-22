/**
 * Visual IQ Challenges — Raven-style matrices plus mental rotation / mirror tasks.
 *
 *  • Matrix: a 3×3 grid of figures. Each "active" attribute follows a rule:
 *      row          constant along each row, differs between rows
 *      column       constant down each column, differs between columns
 *      progression  steps across each row (count +1, size s→m→l, rotation +45/90°)
 *      distribution every row contains the same three values in a Latin-square order
 *    The bottom-right cell is missing. Decoys differ from the answer in at
 *    least one attribute and are visually distinct (Figures.key).
 *
 *  • Rotation: pick the option that is the target shape rotated (decoys are
 *    mirror images — the shape is verified chiral so no mirror equals a rotation).
 *  • Mirror: pick the exact left-right reflection (decoys are rotations /
 *    a top-bottom flip / altered shapes).
 */
(function (App3) {
  'use strict';

  var QuizGame = App3.games.QuizGame;
  var Figures = App3.games.Figures;
  var Poly = Figures.poly;

  var MATRIX_CFG = {
    easy:   { active: 1, rules: ['row', 'column', 'progression'], options: 4 },
    medium: { active: 2, rules: ['row', 'column', 'progression', 'distribution'], options: 6 },
    hard:   { active: 3, rules: ['row', 'column', 'progression', 'distribution'], options: 6 },
    expert: { active: 4, rules: ['progression', 'distribution', 'distribution', 'row', 'column'], options: 8 }
  };
  var POLY_CFG = {
    easy:   { cells: [4, 5], options: 4 },
    medium: { cells: [5, 6], options: 4 },
    hard:   { cells: [6, 7], options: 5 },
    expert: { cells: [7, 8], options: 6 }
  };
  var ROUND_SIZE = { easy: 5, medium: 6, hard: 7, expert: 8 };
  var MATRIX_ATTRS = ['shape', 'color', 'count', 'size', 'fill', 'rotation'];
  var PROGRESSIVE = ['count', 'size', 'rotation'];

  // ---------------------------------------------------------------- matrix

  function makeMatrixRule(rng, attr, kind, asym) {
    var vals, step, start;
    if (kind === 'progression') {
      if (attr === 'count') { start = rng.int(1, 2); return { attr: attr, kind: kind, at: function (r, c) { return start + c; }, text: 'the number of shapes increases by one across each row' }; }
      if (attr === 'size') return { attr: attr, kind: kind, at: function (r, c) { return Figures.SIZES[c]; }, text: 'the size grows small → medium → large across each row' };
      step = rng.pick([45, 90]);
      var base = rng.pick(Figures.ROTATIONS);
      var rowShift = rng.pick([0, step]);
      return { attr: attr, kind: kind, at: function (r, c) { return (base + r * rowShift + c * step) % 360; },
        text: 'each figure rotates ' + step + '° clockwise from the one on its left' };
    }
    vals = rng.sample(Figures.pool(attr, { asym: asym, maxCount: 3 }), 3);
    var label = Figures.ATTR_LABELS[attr];
    if (kind === 'row') return { attr: attr, kind: kind, at: function (r) { return vals[r]; }, text: 'the ' + label + ' is the same along each row' };
    if (kind === 'column') return { attr: attr, kind: kind, at: function (r, c) { return vals[c]; }, text: 'the ' + label + ' is the same down each column' };
    var shift = rng.pick([1, 2]);
    return { attr: attr, kind: 'distribution', at: function (r, c) { return vals[(c + r * shift) % 3]; },
      text: 'each row contains each ' + label + ' (' + vals.map(function (v) { return Figures.attrValueName(attr, v); }).join(', ') + ') exactly once' };
  }

  function buildMatrix(rng, difficulty) {
    var cfg = MATRIX_CFG[difficulty] || MATRIX_CFG.easy;
    for (var attempt = 0; attempt < 80; attempt++) {
      var attrs = rng.sample(MATRIX_ATTRS, cfg.active);
      var asym = attrs.indexOf('rotation') >= 0;
      var rules = attrs.map(function (a) {
        var kinds = cfg.rules.filter(function (k) { return k !== 'progression' || PROGRESSIVE.indexOf(a) >= 0; });
        return makeMatrixRule(rng, a, rng.pick(kinds), asym);
      });
      var base = {
        shape: rng.pick(asym ? Figures.ASYM : Figures.SHAPES), color: rng.pick(Figures.COLOR_IDS),
        count: 1, size: 'l', fill: 'solid', rotation: 0
      };
      var cells = [];
      for (var r = 0; r < 3; r++) {
        for (var c = 0; c < 3; c++) {
          var f = Object.assign({}, base);
          rules.forEach(function (rule) { f[rule.attr] = rule.at(r, c); });
          if (f.count > 1 && attrs.indexOf('size') < 0) f.size = 'm';
          cells.push(f);
        }
      }
      var answer = cells[8];
      var opts = [answer], keys = {};
      keys[Figures.key(answer)] = true;
      function addOpt(f) {
        var k = Figures.key(f);
        if (keys[k] || opts.length >= cfg.options) return;
        keys[k] = true;
        opts.push(f);
      }
      // Classic decoys: neighbouring cells, then single-attribute changes.
      if (difficulty !== 'easy') { addOpt(cells[7]); addOpt(cells[5]); }
      var tries = 0;
      while (opts.length < cfg.options && tries++ < 300) {
        var attr = rng.chance(0.8) ? rng.pick(attrs) : rng.pick(MATRIX_ATTRS);
        var d = Object.assign({}, answer);
        var pool = Figures.pool(attr, { asym: asym, maxCount: 4 }).filter(function (v) { return v !== answer[attr]; });
        d[attr] = rng.pick(pool);
        if ((difficulty === 'hard' || difficulty === 'expert') && rng.chance(0.35)) {
          var attr2 = rng.pick(attrs);
          if (attr2 !== attr) d[attr2] = rng.pick(Figures.pool(attr2, { asym: asym, maxCount: 4 }));
        }
        addOpt(d);
      }
      if (opts.length < cfg.options) continue;
      rng.shuffle(opts);
      var q = {
        kind: 'matrix',
        prompt: 'Which figure completes the matrix?',
        cells: cells.slice(0, 8),
        options: opts,
        answer: opts.indexOf(answer),
        hint: 'Look at how the ' + Figures.ATTR_LABELS[rules[0].attr] + ' changes along each row and down each column.',
        explain: 'Rule' + (rules.length > 1 ? 's' : '') + ': ' + rules.map(function (x) { return x.text; }).join('; ') + '.'
      };
      if (validateMatrix(q, answer)) return q;
    }
    throw new Error('Could not build matrix question');
  }

  /** Options visually unique and exactly one equals the rule-derived answer. */
  function validateMatrix(q, answer) {
    var ak = Figures.key(answer), seen = {}, hits = 0;
    for (var i = 0; i < q.options.length; i++) {
      var k = Figures.key(q.options[i]);
      if (seen[k]) return false;
      seen[k] = true;
      if (k === ak) hits++;
    }
    return hits === 1 && Figures.key(q.options[q.answer]) === ak;
  }

  // --------------------------------------------------- mental rotation/mirror

  function randomPoly(rng, size) {
    var cells = [[0, 0]], set = { '0,0': true };
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var guard = 0;
    while (cells.length < size && guard++ < 500) {
      var from = rng.pick(cells), d = rng.pick(dirs);
      var nx = from[0] + d[0], ny = from[1] + d[1];
      if (set[nx + ',' + ny]) continue;
      set[nx + ',' + ny] = true;
      cells.push([nx, ny]);
    }
    return Poly.normalize(cells);
  }

  function isConnected(cells) {
    var set = {};
    cells.forEach(function (c) { set[c[0] + ',' + c[1]] = true; });
    var stack = [cells[0]], seen = {}, n = 0;
    seen[cells[0][0] + ',' + cells[0][1]] = true;
    while (stack.length) {
      var c = stack.pop(); n++;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var k = (c[0] + d[0]) + ',' + (c[1] + d[1]);
        if (set[k] && !seen[k]) { seen[k] = true; stack.push([c[0] + d[0], c[1] + d[1]]); }
      });
    }
    return n === cells.length;
  }

  /** Move one cell somewhere else (keeping it connected) to make a near-miss decoy. */
  function alterPoly(rng, cells) {
    for (var t = 0; t < 50; t++) {
      var copy = cells.map(function (c) { return c.slice(); });
      var idx = rng.int(0, copy.length - 1);
      copy.splice(idx, 1);
      var anchor = rng.pick(copy), d = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      var nc = [anchor[0] + d[0], anchor[1] + d[1]];
      if (copy.some(function (c) { return c[0] === nc[0] && c[1] === nc[1]; })) continue;
      copy.push(nc);
      if (isConnected(copy)) return Poly.normalize(copy);
    }
    return null;
  }

  function buildSpatial(rng, difficulty, mode) {
    var cfg = POLY_CFG[difficulty] || POLY_CFG.easy;
    for (var attempt = 0; attempt < 100; attempt++) {
      var shape = randomPoly(rng, rng.int(cfg.cells[0], cfg.cells[1]));
      var rotKeys = Poly.rotationKeys(shape);
      var mirror = Poly.mirror(shape);
      var mirKeys = Poly.rotationKeys(mirror);
      // Must be chiral: no rotation of the mirror equals the shape.
      if (Object.keys(rotKeys).some(function (k) { return mirKeys[k]; })) continue;
      // Must not be rotationally symmetric (so rotations are visibly different).
      if (Object.keys(rotKeys).length < 4) continue;

      var target = shape, correct, decoys = [];
      if (mode === 'rotate') {
        target = Poly.rotate(shape, rng.int(0, 3));
        correct = Poly.rotate(shape, rng.int(0, 3));
        if (Poly.key(correct) === Poly.key(target)) correct = Poly.rotate(correct, 1);
        for (var r = 0; r < 4; r++) decoys.push(Poly.rotate(mirror, r));
      } else {
        correct = Poly.mirror(target);
        for (var r2 = 1; r2 < 4; r2++) decoys.push(Poly.rotate(target, r2));
        if (difficulty === 'hard' || difficulty === 'expert') decoys.unshift(Poly.flipV(target));
      }
      var opts = [correct], seen = {};
      seen[Poly.key(correct)] = true;
      var forbid = mode === 'rotate' ? rotKeys : null;
      rng.shuffle(decoys);
      var push = function (p) {
        if (!p || opts.length >= cfg.options) return;
        var k = Poly.key(p);
        if (seen[k]) return;
        if (forbid && forbid[k]) return;               // a rotation would also be correct
        if (mode === 'mirror' && k === Poly.key(correct)) return;
        seen[k] = true;
        opts.push(p);
      };
      decoys.forEach(push);
      var g = 0;
      while (opts.length < cfg.options && g++ < 60) {
        var alt = alterPoly(rng, target);
        if (!alt) continue;
        var ak = Poly.key(alt);
        if (rotKeys[ak] || mirKeys[ak]) continue;    // must be a genuinely different shape
        push(Poly.rotate(alt, rng.int(0, 3)));
      }
      if (opts.length < cfg.options) continue;
      rng.shuffle(opts);
      var color = rng.pick(Figures.COLOR_IDS);
      var q = {
        kind: mode,
        prompt: mode === 'rotate' ? 'Which option is the same shape, only rotated (not flipped)?' : 'Which option is the exact mirror image (reflected left ↔ right)?',
        target: target, options: opts, color: color,
        answer: opts.findIndex(function (p) { return Poly.key(p) === Poly.key(correct); }),
        hint: mode === 'rotate' ? 'Mirror images are traps — track one distinctive corner as you turn the shape.'
          : 'Imagine a vertical mirror beside the shape: the top stays on top, left and right swap.',
        explain: mode === 'rotate' ? 'The other options are mirror images or different shapes.' : 'A left-right reflection keeps the shape upright; rotations and top-bottom flips are different.'
      };
      if (validateSpatial(q, shape)) return q;
    }
    throw new Error('Could not build spatial question');
  }

  /** Exactly one option is correct under the question's rule. */
  function validateSpatial(q, shape) {
    var correctCount = 0, seen = {};
    var rotKeys = Poly.rotationKeys(q.target);
    var mirrorKey = Poly.key(Poly.mirror(q.target));
    for (var i = 0; i < q.options.length; i++) {
      var k = Poly.key(q.options[i]);
      if (seen[k]) return false;
      seen[k] = true;
      var ok = q.kind === 'rotate' ? !!rotKeys[k] && k !== Poly.key(q.target) : k === mirrorKey;
      if (ok) { correctCount++; if (i !== q.answer) return false; }
    }
    return correctCount === 1 && !!shape;
  }

  function buildRound(rng, difficulty) {
    var n = ROUND_SIZE[difficulty] || 5;
    var qs = [];
    for (var i = 0; i < n; i++) {
      var r = rng.next();
      if (r < 0.55) qs.push(buildMatrix(rng, difficulty));
      else if (r < 0.82) qs.push(buildSpatial(rng, difficulty, 'rotate'));
      else qs.push(buildSpatial(rng, difficulty, 'mirror'));
    }
    return qs;
  }

  // -------------------------------------------------------------------- view

  class VisualIQGame extends QuizGame {
    static buildRound(rng, difficulty) { return buildRound(rng, difficulty); }

    renderStimulus(q) {
      if (q.kind === 'matrix') {
        return '<div class="matrix">' + q.cells.map(function (f) { return '<div class="fig-tile">' + Figures.svg(f) + '</div>'; }).join('') +
          '<div class="fig-tile q">?</div></div>';
      }
      return '<div class="poly-target"><div class="fig-tile big">' + Poly.svg(q.target, { color: q.color, label: 'target shape' }) + '</div></div>';
    }

    renderOption(q, opt) {
      if (q.kind === 'matrix') return Figures.svg(opt);
      return Poly.svg(opt, { color: q.color });
    }

    optionsClass(q) { return 'figs n' + q.options.length; }
  }

  VisualIQGame.meta = {
    id: 'visual',
    name: 'Visual IQ',
    description: 'Raven-style matrices, mental rotation and mirror-image challenges.',
    icon: '🧠',
    color: '#a855f7',
    parTime: { easy: 75, medium: 120, hard: 170, expert: 240 },
    difficultyInfo: { easy: '1 rule, small shapes', medium: '2 rules', hard: '3 rules, flips', expert: '4 rules, 8 options' }
  };
  VisualIQGame.engine = { buildRound: buildRound, buildMatrix: buildMatrix, buildSpatial: buildSpatial, validateMatrix: validateMatrix, validateSpatial: validateSpatial };

  App3.games.VisualIQGame = VisualIQGame;
  App3.games.registry.register(VisualIQGame);
})(window.App3);
