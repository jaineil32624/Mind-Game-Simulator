/**
 * Memory Match — flip cards to find matching pairs.
 *
 * Difficulty changes grid size, preview time and how visually similar the
 * symbols are (Hard/Expert draw from fewer shapes, so pairs differ only by
 * colour or shape).
 *
 * Accuracy counts only *avoidable* mistakes: a mismatch is avoidable when
 * you had already seen the partner of the first card, or the second card
 * was one you had already seen. Perfect memory = 100%.
 */
(function (App3) {
  'use strict';

  var BaseGame = App3.games.BaseGame;
  var Figures = App3.games.Figures;
  var el = App3.core.utils.el;

  var CFG = {
    easy:   { rows: 3, cols: 4, preview: 2500, shapes: 0 },
    medium: { rows: 4, cols: 4, preview: 1200, shapes: 0 },
    hard:   { rows: 4, cols: 5, preview: 0, shapes: 6 },
    expert: { rows: 6, cols: 6, preview: 0, shapes: 4 }
  };

  // ------------------------------------------------------------------ engine

  /** Build a shuffled deck: [{ id, pair, fig }]. */
  function generate(rng, difficulty) {
    var cfg = CFG[difficulty] || CFG.easy;
    var pairs = cfg.rows * cfg.cols / 2;
    var shapes = cfg.shapes ? rng.sample(Figures.SHAPES, cfg.shapes) : rng.shuffled(Figures.SHAPES);
    var colors = rng.shuffled(Figures.COLOR_IDS);
    var combos = [];
    shapes.forEach(function (s) { colors.forEach(function (c) { combos.push({ shape: s, color: c }); }); });
    rng.shuffle(combos);
    var chosen = [];
    if (!cfg.shapes) {
      // Easy/Medium: prefer all-different shapes and colours where possible.
      var usedS = {}, usedC = {};
      combos.forEach(function (cb) {
        if (chosen.length < pairs && !usedS[cb.shape] && !usedC[cb.color]) { chosen.push(cb); usedS[cb.shape] = usedC[cb.color] = true; }
      });
      combos.forEach(function (cb) {
        if (chosen.length < pairs && !usedS[cb.shape] && chosen.indexOf(cb) < 0) { chosen.push(cb); usedS[cb.shape] = true; }
      });
    }
    combos.forEach(function (cb) { if (chosen.length < pairs && chosen.indexOf(cb) < 0) chosen.push(cb); });

    var deck = [];
    chosen.forEach(function (cb, p) {
      var fig = { shape: cb.shape, color: cb.color, fill: 'solid', size: 'm', count: 1, rotation: 0 };
      deck.push({ pair: p, fig: fig }, { pair: p, fig: fig });
    });
    rng.shuffle(deck);
    deck.forEach(function (c, i) { c.id = i; });
    return { rows: cfg.rows, cols: cfg.cols, preview: cfg.preview, deck: deck };
  }

  /** Every pair id appears exactly twice and pair figures are unique. */
  function validate(board) {
    var counts = {}, keys = {};
    board.deck.forEach(function (c) {
      counts[c.pair] = (counts[c.pair] || 0) + 1;
      keys[c.pair] = Figures.key(c.fig);
    });
    var pairIds = Object.keys(counts);
    var uniqueKeys = {};
    pairIds.forEach(function (p) { uniqueKeys[keys[p]] = true; });
    return pairIds.length * 2 === board.deck.length &&
      pairIds.every(function (p) { return counts[p] === 2; }) &&
      Object.keys(uniqueKeys).length === pairIds.length;
  }

  // -------------------------------------------------------------------- view

  class MemoryGame extends BaseGame {
    generate() {
      this.board = generate(this.rng, this.difficulty);
      this.flipped = [];      // indices currently face-up and unmatched
      this.matched = {};
      this.seen = {};
      this.attempts = 0;
      this.avoidable = 0;
      this.pairsFound = 0;
      this.locked = false;
      this.focusIdx = 0;
    }

    render() {
      var self = this;
      this.root.innerHTML = '';
      this.grid = el('div', { class: 'mem-grid', style: { '--cols': String(this.board.cols) }, role: 'grid', 'aria-label': 'Memory cards' });
      this.cards = this.board.deck.map(function (card, i) {
        var b = el('button', { class: 'mem-card', type: 'button', 'aria-label': 'Card ' + (i + 1) + ', face down' });
        b.innerHTML = '<span class="mem-inner"><span class="mem-face mem-back" aria-hidden="true">?</span>' +
          '<span class="mem-face mem-front">' + Figures.svg(card.fig) + '</span></span>';
        b.addEventListener('click', function () { self.flip(i); });
        b.addEventListener('focus', function () { self.focusIdx = i; });
        self.grid.appendChild(b);
        return b;
      });
      this.statusEl = el('div', { class: 'mem-status muted' });
      this.root.appendChild(el('div', { class: 'mem-wrap' }, [this.grid, this.statusEl]));
      this.updateStatus();

      if (this.board.preview > 0) {
        this.locked = true;
        this.cards.forEach(function (b) { b.classList.add('flipped'); });
        this.statusEl.textContent = 'Memorize the cards…';
        this.later(function () {
          self.cards.forEach(function (b) { b.classList.remove('flipped'); });
          self.locked = false;
          self.updateStatus();
        }, this.board.preview);
      }
    }

    updateStatus() {
      var total = this.board.deck.length / 2;
      this.statusEl.textContent = 'Pairs ' + this.pairsFound + ' / ' + total + ' · Attempts ' + this.attempts;
    }

    flip(i) {
      if (this.locked || this.finished || this.matched[i] || this.flipped.indexOf(i) >= 0) return;
      var card = this.board.deck[i];
      this.cards[i].classList.add('flipped');
      this.cards[i].setAttribute('aria-label', 'Card ' + (i + 1) + ', ' + Figures.describe(card.fig));
      this.sound('flip');
      this.flipped.push(i);
      if (this.flipped.length < 2) return;

      var a = this.flipped[0], b = this.flipped[1];
      var A = this.board.deck[a], B = this.board.deck[b];
      this.attempts += 1;
      var self = this;
      if (A.pair === B.pair) {
        this.matched[a] = this.matched[b] = true;
        this.pairsFound += 1;
        this.flipped = [];
        this.later(function () {
          self.cards[a].classList.add('matched');
          self.cards[b].classList.add('matched');
          self.sound('match');
        }, 250);
        this.updateStatus();
        if (this.pairsFound * 2 === this.board.deck.length) {
          var acc = this.attempts ? 1 - this.avoidable / this.attempts : 1;
          this.later(function () { self.sound('win'); }, 500);
          this.complete({ won: true, accuracy: acc, delay: 1000, details: { attempts: this.attempts } });
        }
      } else {
        // Was this mismatch avoidable?
        var partnerOfASeen = this.board.deck.some(function (c, k) { return k !== a && c.pair === A.pair && self.seen[k]; });
        if (partnerOfASeen || this.seen[b]) this.avoidable += 1;
        this.locked = true;
        this.later(function () {
          self.cards[a].classList.remove('flipped');
          self.cards[b].classList.remove('flipped');
          self.cards[a].setAttribute('aria-label', 'Card ' + (a + 1) + ', face down');
          self.cards[b].setAttribute('aria-label', 'Card ' + (b + 1) + ', face down');
          self.flipped = [];
          self.locked = false;
        }, 850);
        this.updateStatus();
      }
      this.seen[a] = this.seen[b] = true;
    }

    getHint() {
      if (this.locked) return null;
      var self = this;
      var deck = this.board.deck;
      if (this.flipped.length === 1) {
        var a = this.flipped[0];
        var partner = deck.findIndex(function (c, k) { return k !== a && c.pair === deck[a].pair; });
        this.glow([partner], 1600);
        return { text: 'The partner of your flipped card is glowing.' };
      }
      var open = deck.map(function (c, k) { return k; }).filter(function (k) { return !self.matched[k]; });
      if (!open.length) return null;
      var pick = this.rng.pick(open);
      var mate = deck.findIndex(function (c, k) { return k !== pick && c.pair === deck[pick].pair; });
      this.locked = true;
      [pick, mate].forEach(function (k) { self.cards[k].classList.add('flipped', 'peek'); self.seen[k] = true; });
      this.later(function () {
        [pick, mate].forEach(function (k) { self.cards[k].classList.remove('flipped', 'peek'); });
        self.locked = false;
      }, 1200);
      return { text: 'Peek! Remember where that pair is.' };
    }

    glow(indices, ms) {
      var self = this;
      indices.forEach(function (k) { self.cards[k].classList.add('hint-glow'); });
      this.later(function () { indices.forEach(function (k) { self.cards[k].classList.remove('hint-glow'); }); }, ms);
    }

    onKey(e) {
      var cols = this.board.cols, n = this.cards.length, i = this.focusIdx;
      var map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
      if (map[e.key] === undefined) return false;
      var j = i + map[e.key];
      if (j < 0 || j >= n) return true;
      this.focusIdx = j;
      this.cards[j].focus();
      return true;
    }
  }

  MemoryGame.meta = {
    id: 'memory',
    name: 'Memory Match',
    description: 'Flip cards and find all matching pairs using as few moves as possible.',
    icon: '🃏',
    color: '#ec4899',
    parTime: { easy: 45, medium: 90, hard: 150, expert: 300 },
    difficultyInfo: { easy: '3×4, preview', medium: '4×4, short preview', hard: '4×5, similar symbols', expert: '6×6, similar symbols' }
  };
  MemoryGame.engine = { generate: generate, validate: validate, CFG: CFG };

  App3.games.MemoryGame = MemoryGame;
  App3.games.registry.register(MemoryGame);
})(window.App3);
