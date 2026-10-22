/**
 * Number Sequences — find the missing term.
 *
 * Rule families: arithmetic, geometric, Fibonacci-like, alternating
 * (interleaved), squares, cubes, triangular, second-order differences,
 * multiply-then-add, primes, alternating operations, Tribonacci.
 *
 * Difficulty changes the rule pool, number ranges, and answer format:
 * Easy/Medium are multiple choice, Hard/Expert require typing the number.
 * Expert sometimes hides a term in the middle instead of the end.
 */
(function (App3) {
  'use strict';

  var QuizGame = App3.games.QuizGame;

  var PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113];

  function sign(rng, p) { return rng.chance(p) ? -1 : 1; }
  function seqFrom(n, first, nextFn) {
    var t = first.slice();
    while (t.length < n) t.push(nextFn(t, t.length));
    return t.slice(0, n);
  }

  /** Each generator returns { terms, rule, hint }. n = number of terms needed. */
  var GEN = {
    arithmetic: function (rng, d, n) {
      var a = rng.int(1, d === 'easy' ? 20 : 60);
      var step = rng.int(2, d === 'easy' ? 9 : 19) * (d === 'easy' ? 1 : sign(rng, 0.35));
      return { terms: seqFrom(n, [a], function (t) { return t[t.length - 1] + step; }),
        rule: (step > 0 ? 'Add ' : 'Subtract ') + Math.abs(step) + ' each time.',
        hint: 'Check the difference between neighbouring terms.', hint2: 'The difference is always the same.' };
    },
    geometric: function (rng, d, n) {
      var a = rng.int(1, d === 'easy' ? 4 : 6);
      var r = rng.pick(d === 'easy' ? [2, 3] : d === 'expert' ? [2, 3, 4, -2, -3] : [2, 3, 4]);
      return { terms: seqFrom(n, [a], function (t) { return t[t.length - 1] * r; }),
        rule: 'Multiply by ' + r + ' each time.',
        hint: 'Try dividing each term by the one before it.', hint2: 'The ratio between terms is constant.' };
    },
    fibonacci: function (rng, d, n) {
      var a = rng.int(1, 6), b = rng.int(a, a + 7);
      return { terms: seqFrom(n, [a, b], function (t) { return t[t.length - 1] + t[t.length - 2]; }),
        rule: 'Each term is the sum of the two before it.',
        hint: 'Compare each term with the two terms before it.', hint2: 'Add the previous two terms.' };
    },
    tribonacci: function (rng, d, n) {
      var a = rng.int(0, 3), b = rng.int(1, 4), c = rng.int(2, 6);
      return { terms: seqFrom(n, [a, b, c], function (t) { var L = t.length; return t[L - 1] + t[L - 2] + t[L - 3]; }),
        rule: 'Each term is the sum of the three before it.',
        hint: 'Each term depends on several earlier terms.', hint2: 'Add the previous three terms.' };
    },
    alternating: function (rng, d, n) {
      var a1 = rng.int(1, 30), d1 = rng.int(2, 9) * sign(rng, 0.3);
      var a2 = rng.int(1, 30), d2 = rng.int(2, 9) * sign(rng, 0.3);
      if (d1 === d2) d2 += 1;
      var t = [];
      for (var k = 0; k < n; k++) t.push(k % 2 === 0 ? a1 + d1 * (k / 2) : a2 + d2 * ((k - 1) / 2));
      return { terms: t,
        rule: 'Two interleaved sequences: one ' + (d1 > 0 ? 'adds ' : 'subtracts ') + Math.abs(d1) + ', the other ' + (d2 > 0 ? 'adds ' : 'subtracts ') + Math.abs(d2) + '.',
        hint: 'Look at every other term separately.', hint2: 'Positions 1,3,5… form one sequence; 2,4,6… form another.' };
    },
    squares: function (rng, d, n) {
      var o = rng.int(1, 7), c = d === 'easy' ? 0 : rng.int(-5, 5);
      var t = [];
      for (var k = 0; k < n; k++) t.push((k + o) * (k + o) + c);
      return { terms: t,
        rule: 'Square numbers ' + (o) + '², ' + (o + 1) + '², …' + (c ? (c > 0 ? ' plus ' : ' minus ') + Math.abs(c) : '') + '.',
        hint: 'Could these be perfect squares (possibly shifted)?', hint2: 'The differences between terms go up by 2.' };
    },
    cubes: function (rng, d, n) {
      var o = rng.int(1, 4), c = d === 'expert' ? rng.int(-3, 3) : 0;
      var t = [];
      for (var k = 0; k < n; k++) t.push(Math.pow(k + o, 3) + c);
      return { terms: t,
        rule: 'Cube numbers ' + o + '³, ' + (o + 1) + '³, …' + (c ? (c > 0 ? ' plus ' : ' minus ') + Math.abs(c) : '') + '.',
        hint: 'These grow fast — think powers.', hint2: 'Try cube numbers: 1, 8, 27, 64, 125…' };
    },
    triangular: function (rng, d, n) {
      var o = rng.int(1, 6), t = [];
      for (var k = 0; k < n; k++) t.push((k + o) * (k + o + 1) / 2);
      return { terms: t, rule: 'Triangular numbers: the gaps grow by 1 each time.',
        hint: 'Look at how the differences change.', hint2: 'The differences are consecutive whole numbers.' };
    },
    secondOrder: function (rng, d, n) {
      var a = rng.int(1, 25), d0 = rng.int(1, 7), e = rng.int(2, 5) * (d === 'expert' ? sign(rng, 0.3) : 1);
      var t = [a];
      for (var k = 1; k < n; k++) t.push(t[k - 1] + d0 + e * (k - 1));
      return { terms: t, rule: 'The differences change by ' + e + ' each time (' + d0 + ', ' + (d0 + e) + ', ' + (d0 + 2 * e) + ', …).',
        hint: 'Write out the differences between terms — then look at those.', hint2: 'The differences form an arithmetic sequence.' };
    },
    mulAdd: function (rng, d, n) {
      var a = rng.int(1, 5), m = rng.pick([2, 3]), c = rng.pick([-3, -2, -1, 1, 2, 3]);
      return { terms: seqFrom(n, [a], function (t) { return t[t.length - 1] * m + c; }),
        rule: 'Multiply by ' + m + ', then ' + (c > 0 ? 'add ' : 'subtract ') + Math.abs(c) + '.',
        hint: 'Each term comes from the previous one by a multiplication and a small adjustment.',
        hint2: 'Try ×' + m + ' and see how far off you are.' };
    },
    primes: function (rng, d, n) {
      var off = rng.int(0, 8);
      var mult = d === 'expert' && rng.chance(0.5) ? 2 : 1;
      var t = [];
      for (var k = 0; k < n; k++) t.push(PRIMES[off + k] * mult);
      return { terms: t, rule: (mult > 1 ? 'Double the ' : '') + 'consecutive prime numbers.',
        hint: mult > 1 ? 'Halve each term — what do you notice?' : 'These numbers have exactly two divisors.',
        hint2: 'Think prime numbers: 2, 3, 5, 7, 11, 13…' };
    },
    altOps: function (rng, d, n) {
      var a = rng.int(1, 9), p = rng.int(2, 9), m = rng.pick([2, 3]);
      return { terms: seqFrom(n, [a], function (t, i) { var last = t[t.length - 1]; return i % 2 === 1 ? last + p : last * m; }),
        rule: 'Alternately add ' + p + ' and multiply by ' + m + '.',
        hint: 'The rule alternates between two different operations.', hint2: 'One step adds, the next multiplies.' };
    }
  };

  var POOL = {
    easy: ['arithmetic', 'arithmetic', 'geometric', 'squares'],
    medium: ['arithmetic', 'geometric', 'fibonacci', 'alternating', 'squares', 'triangular'],
    hard: ['geometric', 'fibonacci', 'alternating', 'secondOrder', 'mulAdd', 'cubes', 'primes', 'triangular'],
    expert: ['secondOrder', 'mulAdd', 'altOps', 'tribonacci', 'primes', 'alternating', 'cubes', 'fibonacci', 'geometric']
  };
  var SHOW = { easy: 5, medium: 5, hard: 6, expert: 6 };
  var MIN_SHOW = { alternating: 6, tribonacci: 6, altOps: 6 };
  var ROUND_SIZE = { easy: 5, medium: 6, hard: 7, expert: 8 };

  function distractors(rng, terms, missing, ans, k) {
    var out = [], seen = {};
    seen[ans] = true;
    function add(v) {
      if (out.length >= k || !isFinite(v) || Math.round(v) !== v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    }
    if (missing >= 2) {
      var a = terms[missing - 1], b = terms[missing - 2];
      add(a + (a - b));       // "the gap stays the same"
      if (b !== 0 && a % b === 0) add(a * (a / b));
    }
    var diff = missing >= 1 ? Math.abs(ans - terms[missing - 1]) || 1 : 1;
    rng.shuffled([ans + 1, ans - 1, ans + 2, ans - 2, ans + diff, ans - diff, ans + 10, ans * 2, Math.round(ans * 1.5)]).forEach(add);
    var bump = 3;
    while (out.length < k) add(ans + bump++);
    return out;
  }

  function validateQuestion(q) {
    if (!q.terms.every(function (v) { return Number.isInteger(v) && Math.abs(v) < 1e7; })) return false;
    if (q.terms[q.missing] !== q.answerValue) return false;
    if (q.display.filter(function (v) { return v === '?'; }).length !== 1) return false;
    var distinct = {};
    q.terms.forEach(function (v) { distinct[v] = true; });
    if (Object.keys(distinct).length < 3) return false;
    if (!q.input) {
      if (q.options[q.answer] !== q.answerValue) return false;
      var s = {};
      for (var i = 0; i < q.options.length; i++) { if (s[q.options[i]]) return false; s[q.options[i]] = true; }
    }
    return true;
  }

  function buildQuestion(rng, difficulty) {
    for (var attempt = 0; attempt < 50; attempt++) {
      var type = rng.pick(POOL[difficulty] || POOL.easy);
      var L = Math.max(SHOW[difficulty] || 5, MIN_SHOW[type] || 0);
      var g = GEN[type](rng, difficulty, L + 1);
      var terms = g.terms;
      var missing = L;
      var display;
      if (difficulty === 'expert' && rng.chance(0.3)) {
        missing = rng.int(2, L - 1);
        display = terms.map(function (v, i) { return i === missing ? '?' : v; });
      } else {
        display = terms.slice(0, L).concat(['?']);
      }
      var ans = terms[missing];
      var input = difficulty === 'hard' || difficulty === 'expert';
      var q = {
        kind: 'sequence', type: type,
        prompt: missing === L ? 'What number comes next?' : 'What number is missing?',
        terms: terms, display: display, missing: missing,
        answerValue: ans, input: input,
        hint: g.hint, hint2: g.hint2, explain: g.rule
      };
      if (!input) {
        var opts = [ans].concat(distractors(rng, terms, missing, ans, 3));
        rng.shuffle(opts);
        q.options = opts;
        q.answer = opts.indexOf(ans);
      }
      if (validateQuestion(q)) return q;
    }
    throw new Error('Could not build sequence question');
  }

  function buildRound(rng, difficulty) {
    var n = ROUND_SIZE[difficulty] || 5;
    var qs = [], lastType = null;
    while (qs.length < n) {
      var q = buildQuestion(rng, difficulty);
      if (q.type === lastType && rng.chance(0.7)) continue; // keep rounds varied
      lastType = q.type;
      qs.push(q);
    }
    return qs;
  }

  class SequenceGame extends QuizGame {
    static buildRound(rng, difficulty) { return buildRound(rng, difficulty); }

    renderStimulus(q) {
      return '<div class="seq-row">' + q.display.map(function (v) {
        return '<span class="seq-tile' + (v === '?' ? ' q' : '') + '">' + v + '</span>';
      }).join('') + '</div>';
    }

    renderOption(q, opt) { return '<span class="seq-opt">' + opt + '</span>'; }

    optionsClass() { return 'nums'; }
  }

  SequenceGame.meta = {
    id: 'sequence',
    name: 'Number Sequences',
    description: 'Crack the rule behind each sequence — arithmetic, geometric, Fibonacci and trickier.',
    icon: '📈',
    color: '#f59e0b',
    parTime: { easy: 60, medium: 100, hard: 160, expert: 240 },
    difficultyInfo: { easy: 'Multiple choice', medium: 'Multiple choice, mixed rules', hard: 'Type the answer', expert: 'Type it, hidden middle terms' }
  };
  SequenceGame.engine = { buildRound: buildRound, buildQuestion: buildQuestion, validateQuestion: validateQuestion, GEN: GEN };

  App3.games.SequenceGame = SequenceGame;
  App3.games.registry.register(SequenceGame);
})(window.App3);
