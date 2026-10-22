/**
 * Pattern Recognition — rounds of two generated question types:
 *
 *  • Odd one out: n figures share a KEY attribute value except one. Harder
 *    levels add "noise" attributes that vary between figures — but every
 *    noise value appears at least twice, so only the key attribute produces
 *    a unique odd figure. validateOdd() re-checks this from the data.
 *
 *  • What comes next: a row of figures where 1–3 attributes progress
 *    (rotation steps, count +1, colour/shape/fill/size cycles). Options are
 *    the true next figure plus visually distinct one-attribute-off decoys.
 */
(function (App3) {
  'use strict';

  var QuizGame = App3.games.QuizGame;
  var Figures = App3.games.Figures;

  var ATTRS = ['shape', 'color', 'fill', 'count', 'size', 'rotation'];

  var ODD_CFG = {
    easy:   { n: 4,  keys: ['shape', 'color'], noise: 0 },
    medium: { n: 6,  keys: ['shape', 'color', 'fill', 'count'], noise: 1 },
    hard:   { n: 8,  keys: ['fill', 'count', 'size', 'rotation'], noise: 2 },
    expert: { n: 9,  keys: ['rotation', 'size', 'fill', 'count'], noise: 3 }
  };
  var SERIES_CFG = {
    easy:   { len: 4, changing: 1, options: 4, attrs: ['count', 'color', 'rotation'] },
    medium: { len: 4, changing: 2, options: 4, attrs: ['count', 'color', 'rotation', 'shape', 'fill'] },
    hard:   { len: 5, changing: 2, options: 5, attrs: ['count', 'color', 'rotation', 'shape', 'fill', 'size'] },
    expert: { len: 5, changing: 3, options: 6, attrs: ['count', 'color', 'rotation', 'shape', 'fill', 'size'] }
  };
  var ROUND_SIZE = { easy: 5, medium: 6, hard: 7, expert: 8 };

  // ------------------------------------------------------------ odd-one-out

  function baseFigure(rng, asym) {
    return {
      shape: rng.pick(asym ? Figures.ASYM : Figures.SHAPES),
      color: rng.pick(Figures.COLOR_IDS),
      fill: rng.pick(Figures.FILLS),
      count: rng.int(1, 3),
      size: rng.pick(['m', 'l']),
      rotation: asym ? rng.pick(Figures.ROTATIONS) : 0
    };
  }

  /** Spread k distinct values over n slots so each appears >= 2 times. */
  function spread(rng, values, n) {
    var maxK = Math.max(2, Math.min(values.length, Math.floor(n / 2)));
    var k = rng.int(2, maxK);
    var chosen = rng.sample(values, k);
    var out = [];
    for (var i = 0; i < n; i++) out.push(chosen[i % k]);
    return rng.shuffle(out);
  }

  /**
   * Valid iff exactly one attribute has a singleton value, that attribute's
   * other values are all equal, and the singleton is the answer.
   */
  function validateOdd(q) {
    var items = q.options;
    var oddAttrs = [];
    for (var a = 0; a < ATTRS.length; a++) {
      var attr = ATTRS[a];
      var counts = {};
      items.forEach(function (f) { var v = Figures.visibleAttr(f, attr); counts[v] = (counts[v] || 0) + 1; });
      var singles = Object.keys(counts).filter(function (v) { return counts[v] === 1; });
      if (singles.length) oddAttrs.push({ attr: attr, singles: singles, distinct: Object.keys(counts).length });
    }
    if (oddAttrs.length !== 1) return false;
    var o = oddAttrs[0];
    if (o.singles.length !== 1 || o.distinct !== 2) return false;
    return String(Figures.visibleAttr(items[q.answer], o.attr)) === o.singles[0];
  }

  function buildOdd(rng, difficulty) {
    var cfg = ODD_CFG[difficulty] || ODD_CFG.easy;
    for (var attempt = 0; attempt < 60; attempt++) {
      var key = rng.pick(cfg.keys);
      var noiseAttrs = rng.sample(ATTRS.filter(function (x) { return x !== key; }), cfg.noise);
      var needAsym = key === 'rotation' || noiseAttrs.indexOf('rotation') >= 0;
      var base = baseFigure(rng, needAsym);
      var items = [];
      for (var i = 0; i < cfg.n; i++) items.push(Object.assign({}, base));
      noiseAttrs.forEach(function (attr) {
        var vals = spread(rng, Figures.pool(attr, { asym: needAsym, maxCount: 4 }), cfg.n);
        items.forEach(function (f, idx) { f[attr] = vals[idx]; });
      });
      var oddIdx = rng.int(0, cfg.n - 1);
      var candidates = Figures.pool(key, { asym: needAsym, maxCount: 4 }).filter(function (v) { return v !== base[key]; });
      items[oddIdx][key] = rng.pick(candidates);
      var q = {
        kind: 'odd',
        prompt: 'Which figure is the odd one out?',
        options: items,
        answer: oddIdx,
        hint: 'Ignore what varies a lot — focus on the ' + Figures.ATTR_LABELS[key] + '.',
        explain: 'Every other figure has the same ' + Figures.ATTR_LABELS[key] + ' (' +
          Figures.attrValueName(key, base[key]) + '); this one is ' + Figures.attrValueName(key, items[oddIdx][key]) + '.'
      };
      if (validateOdd(q)) return q;
    }
    throw new Error('Could not build odd-one-out question');
  }

  // ---------------------------------------------------------------- series

  /** Produce a progression rule for one attribute: value(k) for k = 0..len. */
  function makeRule(rng, attr, len, asym) {
    switch (attr) {
      case 'rotation':
        var step = rng.pick([45, 90, -45, -90]);
        var start = rng.pick(Figures.ROTATIONS);
        return { attr: attr, at: function (k) { return ((start + step * k) % 360 + 360) % 360; },
          text: 'rotates ' + Math.abs(step) + '° ' + (step > 0 ? 'clockwise' : 'anticlockwise') + ' each step' };
      case 'count':
        var c0 = rng.int(1, Math.max(1, 6 - len));
        return { attr: attr, at: function (k) { return c0 + k; }, text: 'gains one shape each step' };
      default:
        var poolVals = Figures.pool(attr, { asym: asym });
        var cyc = rng.sample(poolVals, Math.min(poolVals.length, rng.pick([2, 3])));
        return { attr: attr, at: function (k) { return cyc[k % cyc.length]; },
          text: 'cycles through ' + cyc.map(function (v) { return Figures.attrValueName(attr, v); }).join(' → ') };
    }
  }

  function buildSeries(rng, difficulty) {
    var cfg = SERIES_CFG[difficulty] || SERIES_CFG.easy;
    for (var attempt = 0; attempt < 60; attempt++) {
      var attrs = rng.sample(cfg.attrs, cfg.changing);
      var asym = attrs.indexOf('rotation') >= 0;
      var base = baseFigure(rng, asym);
      base.count = 1;
      base.size = 'l';
      if (!asym) base.rotation = 0;
      var rules = attrs.map(function (a) { return makeRule(rng, a, cfg.len, asym); });
      var seq = [];
      for (var k = 0; k <= cfg.len; k++) {
        var f = Object.assign({}, base);
        rules.forEach(function (r) { f[r.attr] = r.at(k); });
        if (f.count > 1 && attrs.indexOf('size') < 0) f.size = 'm';
        seq.push(f);
      }
      var answer = seq[cfg.len];
      var opts = [answer];
      var keys = {};
      keys[Figures.key(answer)] = true;
      // Decoys: change one attribute (prefer the changing ones), plus "repeat the last" trap.
      var tries = 0;
      var trap = seq[cfg.len - 1];
      if (!keys[Figures.key(trap)]) { opts.push(trap); keys[Figures.key(trap)] = true; }
      while (opts.length < cfg.options && tries++ < 200) {
        var attr = rng.chance(0.75) ? rng.pick(attrs) : rng.pick(ATTRS);
        var d = Object.assign({}, answer);
        var vals = Figures.pool(attr, { asym: asym, maxCount: 6 }).filter(function (v) { return v !== answer[attr]; });
        d[attr] = rng.pick(vals);
        var dk = Figures.key(d);
        if (keys[dk]) continue;
        keys[dk] = true;
        opts.push(d);
      }
      if (opts.length < cfg.options) continue;
      rng.shuffle(opts);
      var q = {
        kind: 'series',
        prompt: 'Which figure comes next?',
        series: seq.slice(0, cfg.len),
        options: opts,
        answer: opts.indexOf(answer),
        hint: 'Watch how the ' + attrs.map(function (a) { return Figures.ATTR_LABELS[a]; }).join(' and ') + ' change' + (attrs.length > 1 ? '' : 's') + ' from figure to figure.',
        explain: 'The figure ' + rules.map(function (r) { return r.text; }).join('; it also ') + '.'
      };
      if (validateSeries(q)) return q;
    }
    throw new Error('Could not build series question');
  }

  function validateSeries(q) {
    var seen = {};
    for (var i = 0; i < q.options.length; i++) {
      var k = Figures.key(q.options[i]);
      if (seen[k]) return false;
      seen[k] = true;
    }
    return q.answer >= 0;
  }

  /** Pure round builder (used by the view and the node tests). */
  function buildRound(rng, difficulty) {
    var n = ROUND_SIZE[difficulty] || 5;
    var qs = [];
    for (var i = 0; i < n; i++) qs.push(rng.chance(0.5) ? buildOdd(rng, difficulty) : buildSeries(rng, difficulty));
    return qs;
  }

  // -------------------------------------------------------------------- view

  class PatternGame extends QuizGame {
    static buildRound(rng, difficulty) { return buildRound(rng, difficulty); }

    renderStimulus(q) {
      if (q.kind !== 'series') return '';
      return '<div class="fig-row">' + q.series.map(function (f) { return '<div class="fig-tile">' + Figures.svg(f) + '</div>'; }).join('') +
        '<div class="fig-tile q">?</div></div>';
    }

    renderOption(q, opt) { return Figures.svg(opt); }

    optionsClass(q) { return 'figs ' + (q.kind === 'odd' ? 'odd n' + q.options.length : 'n' + q.options.length); }
  }

  PatternGame.meta = {
    id: 'pattern',
    name: 'Pattern Recognition',
    description: 'Spot the odd figure out and predict what comes next in visual sequences.',
    icon: '🔷',
    color: '#3b82f6',
    parTime: { easy: 60, medium: 90, hard: 130, expert: 180 },
    difficultyInfo: { easy: '5 questions', medium: '6 questions, distractors', hard: '7 questions, subtle traits', expert: '8 questions, heavy noise' }
  };
  PatternGame.engine = { buildRound: buildRound, buildOdd: buildOdd, buildSeries: buildSeries, validateOdd: validateOdd, validateSeries: validateSeries };

  App3.games.PatternGame = PatternGame;
  App3.games.registry.register(PatternGame);
})(window.App3);
