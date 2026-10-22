/**
 * Sudoku — generator, validator and view.
 *
 * Generator:
 *   1. Fill an empty grid with a randomized backtracking solver (seeded rng).
 *   2. Visit cells in random order and remove each clue only if the puzzle
 *      still has exactly ONE solution (bitmask solver counting up to 2).
 *   3. Stop at the difficulty's clue target (or when no clue can be removed).
 * Every generated puzzle therefore has a unique solution by construction.
 *
 * View: notes/pencil marks, conflict highlighting, undo, number pad,
 * full keyboard support (arrows, 1–9, Backspace, N for notes, Ctrl+Z).
 */
(function (App3) {
  'use strict';

  var BaseGame = App3.games.BaseGame;
  var el = App3.core.utils.el;

  // ------------------------------------------------------------------ engine

  var ROW = [], COL = [], BOXI = [], PEERS = [], UNITS = [];
  (function precompute() {
    for (var i = 0; i < 81; i++) {
      ROW[i] = Math.floor(i / 9);
      COL[i] = i % 9;
      BOXI[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
    }
    for (var u = 0; u < 9; u++) {
      var r = [], c = [], b = [];
      for (var k = 0; k < 81; k++) {
        if (ROW[k] === u) r.push(k);
        if (COL[k] === u) c.push(k);
        if (BOXI[k] === u) b.push(k);
      }
      UNITS.push({ name: 'row ' + (u + 1), cells: r }, { name: 'column ' + (u + 1), cells: c }, { name: 'box ' + (u + 1), cells: b });
    }
    for (var j = 0; j < 81; j++) {
      var peers = [];
      for (var m = 0; m < 81; m++) {
        if (m !== j && (ROW[m] === ROW[j] || COL[m] === COL[j] || BOXI[m] === BOXI[j])) peers.push(m);
      }
      PEERS[j] = peers;
    }
  })();

  var ALL = 0x3FE; // bits 1..9

  function popcount(m) { var n = 0; while (m) { m &= m - 1; n++; } return n; }
  function digitsOf(mask) { var out = []; for (var d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d); return out; }

  /**
   * Backtracking solver with MRV heuristic and bitmasks.
   * @param {number[]} grid 81 values, 0 = empty
   * @param {number} limit stop after this many solutions
   * @param {RNG} [rng] randomize digit order (used to create full grids)
   * @returns {{count:number, solution:number[]|null}}
   */
  function solve(grid, limit, rng) {
    var g = grid.slice();
    var rows = [0, 0, 0, 0, 0, 0, 0, 0, 0], cols = rows.slice(), boxes = rows.slice();
    for (var i = 0; i < 81; i++) {
      var v = g[i];
      if (!v) continue;
      var bit = 1 << v;
      if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOXI[i]]) & bit) return { count: 0, solution: null };
      rows[ROW[i]] |= bit; cols[COL[i]] |= bit; boxes[BOXI[i]] |= bit;
    }
    var count = 0, solution = null;

    function search() {
      var best = -1, bestMask = 0, bestN = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var mask = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOXI[i]]);
        var n = popcount(mask);
        if (n === 0) return false;
        if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n === 1) break; }
      }
      if (best === -1) {
        count++;
        if (!solution) solution = g.slice();
        return count >= limit;
      }
      var ds = digitsOf(bestMask);
      if (rng) rng.shuffle(ds);
      var r = ROW[best], c = COL[best], b = BOXI[best];
      for (var k = 0; k < ds.length; k++) {
        var bit = 1 << ds[k];
        g[best] = ds[k]; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        if (search()) return true;
        rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      }
      g[best] = 0;
      return false;
    }
    search();
    return { count: count, solution: solution };
  }

  function countSolutions(grid, limit) { return solve(grid, limit || 2).count; }

  /** Target number of clues per difficulty. */
  var CLUES = { easy: 38, medium: 32, hard: 27, expert: 23 };

  /** Generate { puzzle, solution, clues } with a guaranteed unique solution. */
  function generate(rng, difficulty) {
    var empty = new Array(81).fill(0);
    var solution = solve(empty, 1, rng).solution;
    var puzzle = solution.slice();
    var target = CLUES[difficulty] || CLUES.medium;
    var order = rng.shuffle(App3.core.utils.range(81));
    var clues = 81;
    for (var k = 0; k < order.length && clues > target; k++) {
      var idx = order[k];
      var saved = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle, 2) !== 1) puzzle[idx] = saved;
      else clues--;
    }
    return { puzzle: puzzle, solution: solution, clues: clues };
  }

  /** Candidate bitmask for an empty cell given the current board. */
  function candidates(board, i) {
    var used = 0;
    PEERS[i].forEach(function (p) { if (board[p]) used |= 1 << board[p]; });
    return ALL & ~used;
  }

  /** Boolean per cell: value duplicates a peer's value. */
  function conflicts(board) {
    var out = new Array(81).fill(false);
    for (var i = 0; i < 81; i++) {
      if (!board[i]) continue;
      var peers = PEERS[i];
      for (var k = 0; k < peers.length; k++) {
        if (board[peers[k]] === board[i]) { out[i] = true; break; }
      }
    }
    return out;
  }

  /** True when the board is complete and valid. */
  function isSolved(board) {
    for (var i = 0; i < 81; i++) if (!board[i]) return false;
    return conflicts(board).indexOf(true) < 0;
  }

  /** Find a naked or hidden single on the board (assumes no wrong entries). */
  function findSingle(board) {
    for (var i = 0; i < 81; i++) {
      if (board[i]) continue;
      var m = candidates(board, i);
      if (popcount(m) === 1) return { index: i, value: digitsOf(m)[0], technique: 'naked' };
    }
    for (var u = 0; u < UNITS.length; u++) {
      var unit = UNITS[u];
      for (var d = 1; d <= 9; d++) {
        var present = false, spots = [];
        for (var k = 0; k < 9; k++) {
          var cell = unit.cells[k];
          if (board[cell] === d) { present = true; break; }
          if (!board[cell] && (candidates(board, cell) & (1 << d))) spots.push(cell);
        }
        if (!present && spots.length === 1) return { index: spots[0], value: d, technique: 'hidden', unit: unit.name };
      }
    }
    return null;
  }

  var Engine = {
    solve: solve, countSolutions: countSolutions, generate: generate, candidates: candidates,
    conflicts: conflicts, isSolved: isSolved, findSingle: findSingle, CLUES: CLUES, PEERS: PEERS
  };

  function cellName(i) { return 'R' + (ROW[i] + 1) + 'C' + (COL[i] + 1); }

  // -------------------------------------------------------------------- view

  class SudokuGame extends BaseGame {
    generate() {
      var g = Engine.generate(this.rng, this.difficulty);
      this.solution = g.solution;
      this.givens = g.puzzle.map(function (v) { return v !== 0; });
      this.values = g.puzzle.slice();
      this.notes = new Array(81).fill(0);
      this.selected = this.values.indexOf(0);
      this.notesMode = false;
      this.undoStack = [];
      this.entries = 0;
      this.mistakes = 0;
    }

    render() {
      var self = this;
      this.root.innerHTML = '';
      this.boardEl = el('div', { class: 'sudoku-board', role: 'grid', 'aria-label': 'Sudoku board' });
      this.cellEls = [];
      for (var i = 0; i < 81; i++) {
        var cls = 'sd-cell';
        if (COL[i] % 3 === 2 && COL[i] < 8) cls += ' br';
        if (ROW[i] % 3 === 2 && ROW[i] < 8) cls += ' bb';
        var cell = el('div', { class: cls, role: 'gridcell', dataset: { i: String(i) } });
        this.cellEls.push(cell);
        this.boardEl.appendChild(cell);
      }
      this.listen(this.boardEl, 'click', function (e) {
        var t = e.target.closest('.sd-cell');
        if (t) self.select(Number(t.dataset.i));
      });

      this.notesBtn = el('button', { class: 'btn tool', type: 'button', title: 'Toggle notes (N)', onclick: function () { self.toggleNotes(); } }, '✏️ Notes');
      var eraseBtn = el('button', { class: 'btn tool', type: 'button', title: 'Erase (Backspace)', onclick: function () { self.erase(); } }, '⌫ Erase');
      var undoBtn = el('button', { class: 'btn tool', type: 'button', title: 'Undo (Ctrl+Z)', onclick: function () { self.undo(); } }, '↶ Undo');

      this.padBtns = [];
      var pad = el('div', { class: 'sd-pad' });
      for (var d = 1; d <= 9; d++) {
        (function (digit) {
          var b = el('button', { class: 'sd-num', type: 'button', 'aria-label': 'Enter ' + digit, onclick: function () { self.input(digit); } },
            [String(digit), el('small', { class: 'sd-left' })]);
          self.padBtns.push(b);
          pad.appendChild(b);
        })(d);
      }

      this.infoEl = el('div', { class: 'sd-info muted' });
      this.root.appendChild(el('div', { class: 'sudoku-wrap' }, [
        this.boardEl,
        el('div', { class: 'sudoku-side' }, [
          el('div', { class: 'sd-tools' }, [this.notesBtn, eraseBtn, undoBtn]),
          pad,
          this.infoEl,
          el('p', { class: 'muted small kbd-help' }, 'Keys: arrows move · 1–9 enter · N notes · Backspace erase · Ctrl+Z undo')
        ])
      ]));
      this.refresh();
    }

    select(i) { this.selected = i; this.sound('click'); this.refresh(); }

    toggleNotes() { this.notesMode = !this.notesMode; this.refresh(); }

    snapshot() { this.undoStack.push({ v: this.values.slice(), n: this.notes.slice() }); if (this.undoStack.length > 200) this.undoStack.shift(); }

    input(d) {
      var i = this.selected;
      if (this.finished || i < 0 || this.givens[i]) return;
      if (this.notesMode) {
        if (this.values[i]) return;
        this.snapshot();
        this.notes[i] ^= (1 << d);
        this.sound('click');
      } else {
        if (this.values[i] === d) return;
        this.snapshot();
        this.values[i] = d;
        this.notes[i] = 0;
        this.entries += 1;
        if (d !== this.solution[i]) { this.mistakes += 1; this.sound('error'); }
        else this.sound('click');
        var self = this;
        PEERS[i].forEach(function (p) { self.notes[p] &= ~(1 << d); });
      }
      this.refresh();
      this.checkWin();
    }

    erase() {
      var i = this.selected;
      if (this.finished || i < 0 || this.givens[i]) return;
      if (!this.values[i] && !this.notes[i]) return;
      this.snapshot();
      this.values[i] = 0;
      this.notes[i] = 0;
      this.refresh();
    }

    undo() {
      if (this.finished || !this.undoStack.length) return;
      var s = this.undoStack.pop();
      this.values = s.v;
      this.notes = s.n;
      this.refresh();
    }

    refresh() {
      var conf = Engine.conflicts(this.values);
      var sel = this.selected;
      var selVal = sel >= 0 ? this.values[sel] : 0;
      var counts = new Array(10).fill(0);
      for (var i = 0; i < 81; i++) {
        var v = this.values[i];
        if (v) counts[v]++;
        var c = this.cellEls[i];
        c.classList.toggle('given', this.givens[i]);
        c.classList.toggle('user', !this.givens[i] && !!v);
        c.classList.toggle('selected', i === sel);
        c.classList.toggle('peer', sel >= 0 && i !== sel && (ROW[i] === ROW[sel] || COL[i] === COL[sel] || BOXI[i] === BOXI[sel]));
        c.classList.toggle('same', !!selVal && v === selVal && i !== sel);
        c.classList.toggle('conflict', conf[i]);
        if (v) {
          c.textContent = String(v);
        } else if (this.notes[i]) {
          var html = '<div class="sd-notes">';
          for (var d = 1; d <= 9; d++) html += '<span>' + ((this.notes[i] & (1 << d)) ? d : '') + '</span>';
          c.innerHTML = html + '</div>';
        } else {
          c.textContent = '';
        }
        c.setAttribute('aria-label', cellName(i) + (v ? ' ' + v : ' empty'));
      }
      for (var n = 1; n <= 9; n++) {
        var b = this.padBtns[n - 1];
        b.classList.toggle('done', counts[n] >= 9);
        b.querySelector('.sd-left').textContent = counts[n] >= 9 ? '✓' : String(9 - counts[n]);
      }
      this.notesBtn.classList.toggle('active', this.notesMode);
      this.notesBtn.setAttribute('aria-pressed', String(this.notesMode));
      var empties = this.values.filter(function (x) { return !x; }).length;
      this.infoEl.textContent = empties + ' cells left · ' + this.mistakes + ' mistake' + (this.mistakes === 1 ? '' : 's');
    }

    checkWin() {
      for (var i = 0; i < 81; i++) if (this.values[i] !== this.solution[i]) return;
      this.boardEl.classList.add('solved');
      this.sound('win');
      var acc = this.entries ? (this.entries - this.mistakes) / this.entries : 1;
      this.complete({ won: true, accuracy: acc, delay: 900, details: { mistakes: this.mistakes } });
    }

    /** Place a hinted value (not counted as an entry). */
    placeHint(i, value) {
      this.snapshot();
      this.values[i] = value;
      this.notes[i] = 0;
      var self = this;
      PEERS[i].forEach(function (p) { self.notes[p] &= ~(1 << value); });
      this.selected = i;
      this.refresh();
      var cell = this.cellEls[i];
      cell.classList.remove('flash');
      void cell.offsetWidth;
      cell.classList.add('flash');
      this.checkWin();
    }

    getHint() {
      // 1) Point out (and clear) a wrong entry first.
      for (var i = 0; i < 81; i++) {
        if (this.values[i] && !this.givens[i] && this.values[i] !== this.solution[i]) {
          this.snapshot();
          this.values[i] = 0;
          this.selected = i;
          this.refresh();
          return { text: cellName(i) + ' was incorrect, so it has been cleared.' };
        }
      }
      // 2) Teach a technique: naked or hidden single.
      var s = Engine.findSingle(this.values);
      if (s) {
        var v = this.solution[s.index];
        this.placeHint(s.index, v);
        return {
          text: s.technique === 'naked'
            ? 'Naked single: ' + cellName(s.index) + ' can only be ' + v + ' — every other digit already appears in its row, column or box.'
            : 'Hidden single: in ' + s.unit + ', ' + v + ' fits only in ' + cellName(s.index) + '.'
        };
      }
      // 3) Fallback: reveal the selected (or first) empty cell.
      var target = (this.selected >= 0 && !this.values[this.selected]) ? this.selected : this.values.indexOf(0);
      if (target < 0) return null;
      this.placeHint(target, this.solution[target]);
      return { text: 'No simple single right now — revealed ' + cellName(target) + ' = ' + this.solution[target] + '.' };
    }

    onKey(e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return false;
      var k = e.key;
      var sel = this.selected < 0 ? 0 : this.selected;
      var r = ROW[sel], c = COL[sel];
      if (k === 'ArrowUp') { this.select(((r + 8) % 9) * 9 + c); return true; }
      if (k === 'ArrowDown') { this.select(((r + 1) % 9) * 9 + c); return true; }
      if (k === 'ArrowLeft') { this.select(r * 9 + (c + 8) % 9); return true; }
      if (k === 'ArrowRight') { this.select(r * 9 + (c + 1) % 9); return true; }
      if (/^[1-9]$/.test(k)) { this.input(Number(k)); return true; }
      if (k === 'Backspace' || k === 'Delete' || k === '0') { this.erase(); return true; }
      if (k === 'n' || k === 'N') { this.toggleNotes(); return true; }
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { this.undo(); return true; }
      return false;
    }
  }

  SudokuGame.meta = {
    id: 'sudoku',
    name: 'Sudoku',
    description: 'Fill the 9×9 grid so every row, column and box holds 1–9. Unique solution guaranteed.',
    icon: '🔢',
    color: '#6366f1',
    parTime: { easy: 360, medium: 600, hard: 900, expert: 1200 },
    difficultyInfo: { easy: '38 clues', medium: '32 clues', hard: '27 clues', expert: '≈23 clues' }
  };
  SudokuGame.engine = Engine;

  App3.games.SudokuGame = SudokuGame;
  App3.games.registry.register(SudokuGame);
})(window.App3);
