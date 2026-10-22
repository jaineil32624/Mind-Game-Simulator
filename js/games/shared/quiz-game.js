/**
 * App3.games.QuizGame — shared engine for round-based question modes
 * (Pattern Recognition, Number Sequences, Visual IQ).
 *
 * Subclasses provide:
 *   static buildRound(rng, difficulty) -> Question[]   (pure, testable)
 *   renderStimulus(q) -> HTML string ('' for none)
 *   renderOption(q, option, index) -> HTML string
 *   optionsClass(q) -> extra CSS class for the options container
 *
 * Question shape:
 *   { prompt, options: [...], answer: index }            multiple choice
 *   { prompt, input: true, answerValue: number }          free numeric input
 *   + hint (first hint text), hint2 (second, input mode), explain (shown after answering)
 *
 * A round is won when the share of correct answers >= PASS_RATIO.
 */
(function (App3) {
  'use strict';

  var BaseGame = App3.games.BaseGame;
  var el = App3.core.utils.el;

  var PASS_RATIO = 0.6;

  class QuizGame extends BaseGame {
    generate() {
      this.questions = this.constructor.buildRound(this.rng, this.difficulty);
      this.index = 0;
      this.correctCount = 0;
      this.results = [];
      this.phase = 'asking';
    }

    render() {
      var self = this;
      this.root.innerHTML = '';
      this.progressEl = el('ol', { class: 'quiz-progress', 'aria-label': 'Round progress' });
      this.counterEl = el('div', { class: 'quiz-counter muted' });
      this.promptEl = el('h2', { class: 'quiz-prompt' });
      this.stimEl = el('div', { class: 'quiz-stimulus' });
      this.optsEl = el('div', { class: 'quiz-options' });
      this.feedbackEl = el('div', { class: 'quiz-feedback', 'aria-live': 'polite' });
      this.nextBtn = el('button', { class: 'btn primary quiz-next', type: 'button', hidden: true, onclick: function () { self.next(); } }, 'Next →');
      this.card = el('div', { class: 'quiz card' }, [
        el('div', { class: 'quiz-top' }, [this.progressEl, this.counterEl]),
        this.promptEl, this.stimEl, this.optsEl,
        el('div', { class: 'quiz-bottom' }, [this.feedbackEl, this.nextBtn])
      ]);
      this.root.appendChild(this.card);
      this.showQuestion();
    }

    // --- hooks for subclasses ----------------------------------------------
    renderStimulus(/* q */) { return ''; }
    renderOption(q, opt) { return App3.core.utils.escapeHtml(String(opt)); }
    optionsClass(/* q */) { return ''; }

    // --- flow ---------------------------------------------------------------
    current() { return this.questions[this.index]; }

    showQuestion() {
      var self = this;
      var q = this.current();
      this.phase = 'asking';
      this.qHint = 0;
      this.eliminated = {};

      this.progressEl.innerHTML = '';
      this.questions.forEach(function (_, i) {
        var cls = i < self.index ? (self.results[i] ? 'ok' : 'bad') : (i === self.index ? 'cur' : '');
        self.progressEl.appendChild(el('li', { class: cls }));
      });
      this.counterEl.textContent = 'Question ' + (this.index + 1) + ' / ' + this.questions.length;
      this.promptEl.textContent = q.prompt;

      var stim = this.renderStimulus(q) || '';
      this.stimEl.innerHTML = stim;
      this.stimEl.hidden = !stim;

      this.optsEl.innerHTML = '';
      this.optsEl.className = 'quiz-options ' + (this.optionsClass(q) || '');
      this.optionButtons = [];
      if (q.input) {
        this.inputEl = el('input', {
          class: 'quiz-input', type: 'text', inputmode: 'numeric', autocomplete: 'off',
          'aria-label': 'Your answer', placeholder: 'Type a number'
        });
        var form = el('form', { class: 'quiz-form', onsubmit: function (e) { e.preventDefault(); self.submitInput(self.inputEl.value); } }, [
          this.inputEl,
          el('button', { class: 'btn primary', type: 'submit' }, 'Submit')
        ]);
        this.optsEl.appendChild(form);
        setTimeout(function () { if (self.inputEl) self.inputEl.focus(); }, 30);
      } else {
        q.options.forEach(function (opt, i) {
          var b = el('button', {
            class: 'quiz-opt', type: 'button', 'aria-label': 'Option ' + (i + 1),
            onclick: function () { self.choose(i); }
          });
          b.innerHTML = '<span class="opt-key">' + (i + 1) + '</span>' + self.renderOption(q, opt, i);
          self.optionButtons.push(b);
          self.optsEl.appendChild(b);
        });
      }

      this.feedbackEl.textContent = '';
      this.feedbackEl.className = 'quiz-feedback';
      this.nextBtn.hidden = true;
      this.card.classList.remove('anim-in');
      void this.card.offsetWidth; // restart animation
      this.card.classList.add('anim-in');
    }

    choose(i) {
      if (this.phase !== 'asking' || this.eliminated[i]) return;
      this.resolve(i === this.current().answer, i);
    }

    submitInput(raw) {
      if (this.phase !== 'asking') return;
      var txt = String(raw || '').trim().replace(/,/g, '');
      var v = Number(txt);
      if (txt === '' || !isFinite(v)) {
        this.inputEl.classList.remove('shake');
        void this.inputEl.offsetWidth;
        this.inputEl.classList.add('shake');
        return;
      }
      this.resolve(v === this.current().answerValue, -1);
    }

    resolve(ok, chosen) {
      var q = this.current();
      this.phase = 'answered';
      this.results[this.index] = ok;
      if (ok) this.correctCount += 1;
      this.sound(ok ? 'correct' : 'error');

      this.optionButtons.forEach(function (b, i) {
        b.disabled = true;
        if (i === q.answer) b.classList.add('correct');
        else if (i === chosen) b.classList.add('wrong');
      });
      if (this.inputEl) {
        this.inputEl.disabled = true;
        this.inputEl.classList.add(ok ? 'correct' : 'wrong');
      }
      var head = ok ? '✓ Correct! ' : '✗ Not quite. ';
      if (!ok && q.input) head += 'The answer was ' + q.answerValue + '. ';
      this.feedbackEl.textContent = head + (q.explain || '');
      this.feedbackEl.className = 'quiz-feedback ' + (ok ? 'ok' : 'bad');
      var last = this.index >= this.questions.length - 1;
      this.nextBtn.textContent = last ? 'See results' : 'Next →';
      this.nextBtn.hidden = false;
      var nb = this.nextBtn;
      setTimeout(function () { nb.focus(); }, 30);
    }

    next() {
      if (this.phase !== 'answered' || this.finished) return;
      this.inputEl = null;
      this.index += 1;
      if (this.index >= this.questions.length) { this.finishRound(); return; }
      this.showQuestion();
    }

    finishRound() {
      var n = this.questions.length;
      var acc = n ? this.correctCount / n : 0;
      var won = acc >= PASS_RATIO - 1e-9;
      this.phase = 'done';
      this.nextBtn.hidden = true;
      this.sound(won ? 'win' : 'lose');
      this.complete({ won: won, accuracy: acc, delay: 150, details: { correct: this.correctCount, total: n } });
    }

    /** Hint 1: a rule-focused nudge. Hint 2+: eliminate wrong options (or a stronger nudge for input). */
    getHint() {
      if (this.phase !== 'asking') return null;
      var q = this.current();
      if (this.qHint === 0 && q.hint) {
        this.qHint = 1;
        return { text: q.hint };
      }
      if (q.input) {
        if (q.hint2 && this.qHint < 2) { this.qHint = 2; return { text: q.hint2 }; }
        return null;
      }
      var self = this;
      var wrong = q.options.map(function (_, i) { return i; })
        .filter(function (i) { return i !== q.answer && !self.eliminated[i]; });
      if (wrong.length < 1) return null;
      var k = Math.max(1, Math.floor(wrong.length / 2));
      this.rng.shuffle(wrong).slice(0, k).forEach(function (i) {
        self.eliminated[i] = true;
        var b = self.optionButtons[i];
        b.disabled = true;
        b.classList.add('eliminated');
      });
      this.qHint += 1;
      return { text: 'Removed ' + k + ' wrong option' + (k > 1 ? 's' : '') + '.' };
    }

    onKey(e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return false;
      if (this.phase === 'answered' && e.key === 'Enter' && tag !== 'BUTTON') { this.next(); return true; }
      if (this.phase === 'asking' && !this.current().input && /^[1-9]$/.test(e.key)) {
        var i = Number(e.key) - 1;
        if (i < this.current().options.length) { this.choose(i); return true; }
      }
      return false;
    }
  }

  QuizGame.PASS_RATIO = PASS_RATIO;
  App3.games.QuizGame = QuizGame;
})(window.App3);
