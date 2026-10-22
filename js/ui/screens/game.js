/**
 * Game screen — hosts any registered game mode.
 *
 * Responsibilities (kept out of the games themselves):
 *   header (timer, hints, new puzzle), keyboard forwarding, and on
 *   completion: stats, XP, leaderboard, daily progress, achievements and
 *   the results dialog.
 *
 * Routes:  #/play/<mode>/<difficulty>   |   #/daily/<index>
 */
(function (App3) {
  'use strict';

  var utils = App3.core.utils;
  var el = utils.el;
  var C = App3.ui.components;
  var RNG = App3.core.RNG;

  var GameScreen = {
    game: null,
    timerId: null,
    keyHandler: null,
    ctx: null,

    render: function (root, params) {
      var self = this;
      var registry = App3.games.registry;
      var ctx = { daily: null };

      if (this.routeName() === 'daily') {
        var key = App3.systems.daily.todayKey();
        var challenge = App3.systems.daily.getChallenge(key);
        var item = challenge.items[Number(params[0]) || 0];
        if (!item) { App3.ui.router.navigate('home'); return; }
        ctx.mode = item.mode;
        ctx.difficulty = item.difficulty;
        ctx.seed = item.seed;
        ctx.daily = { key: key, index: item.index };
      } else {
        ctx.mode = params[0];
        ctx.difficulty = App3.DIFFICULTIES.indexOf(params[1]) >= 0 ? params[1] : 'easy';
      }
      var GameClass = registry.get(ctx.mode);
      if (!GameClass) {
        root.appendChild(el('div', { class: 'card' }, [el('h2', null, 'Unknown game mode'), el('a', { class: 'btn primary', href: '#/home' }, 'Back home')]));
        return;
      }
      ctx.GameClass = GameClass;
      this.ctx = ctx;
      var meta = GameClass.meta;

      // --- header -----------------------------------------------------------
      this.timerEl = el('span', { class: 'timer', 'aria-label': 'Elapsed time' }, '0:00');
      this.hintBtn = el('button', { class: 'btn hint-btn', type: 'button', title: 'Hint (H)', onclick: function () { self.useHint(); } }, '💡 Hint');
      this.newBtn = el('button', { class: 'btn ghost', type: 'button', title: ctx.daily ? 'Restart' : 'New puzzle', onclick: function () { self.newPuzzle(); } },
        ctx.daily ? '↻ Restart' : '↻ New');
      var level = ((App3.core.storage.state.progress[meta.id] || {})[ctx.difficulty] || 0) + 1;
      var header = el('div', { class: 'game-header card', style: { '--accent': meta.color } }, [
        el('a', { class: 'btn ghost back', href: '#/home', 'aria-label': 'Back to home' }, '←'),
        el('div', { class: 'game-title' }, [
          el('span', { class: 'mode-icon sm', style: { background: meta.color } }, meta.icon),
          el('div', null, [
            el('h1', null, meta.name),
            el('div', { class: 'game-sub' }, [
              C.difficultyChip(ctx.difficulty),
              this.levelEl = el('span', { class: 'muted small' }, ctx.daily ? '📅 Daily challenge' : 'Level ' + level)
            ])
          ])
        ]),
        el('div', { class: 'game-actions' }, [this.timerEl, this.hintBtn, this.newBtn])
      ]);
      this.area = el('div', { class: 'game-area' });
      root.appendChild(header);
      root.appendChild(this.area);

      this.keyHandler = function (e) {
        if (C.isModalOpen() || !self.game) return;
        if (e.altKey) return;
        var tag = e.target && e.target.tagName;
        if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          self.useHint();
          return;
        }
        if (self.game.onKey(e)) e.preventDefault();
      };
      document.addEventListener('keydown', this.keyHandler);

      this.startGame(ctx.daily ? ctx.seed : RNG.randomSeed());
    },

    routeName: function () { return (location.hash.replace(/^#\/?/, '').split('/')[0]) || 'home'; },

    startGame: function (seed) {
      var self = this, ctx = this.ctx;
      this.stopTimer();
      if (this.game) { this.game.destroy(); this.game = null; }
      this.area.innerHTML = '<div class="loading"><span class="spinner"></span> Generating puzzle…</div>';
      this.updateHintBtn();
      this.updateLevel();
      // Defer so the loading state paints before (potentially heavy) generation.
      setTimeout(function () {
        if (!self.area || !self.area.isConnected) return;
        self.area.innerHTML = '';
        var game = new ctx.GameClass({
          container: self.area,
          difficulty: ctx.difficulty,
          seed: seed,
          daily: !!ctx.daily,
          onComplete: function (res) { self.onComplete(game, res); }
        });
        self.game = game;
        try {
          game.start();
        } catch (e) {
          console.error(e);
          self.area.innerHTML = '<div class="card"><p>Could not generate this puzzle: ' + utils.escapeHtml(e.message) + '</p></div>';
          return;
        }
        self.updateHintBtn();
        self.timerId = setInterval(function () { self.timerEl.textContent = utils.formatTime(game.elapsed()); }, 250);
      }, 30);
    },

    updateLevel: function () {
      var ctx = this.ctx;
      if (!this.levelEl || ctx.daily) return;
      var lv = ((App3.core.storage.state.progress[ctx.GameClass.meta.id] || {})[ctx.difficulty] || 0) + 1;
      this.levelEl.textContent = 'Level ' + lv;
    },

    newPuzzle: function () {
      var self = this;
      var fresh = function () { self.startGame(self.ctx.daily ? self.ctx.seed : RNG.randomSeed()); };
      if (this.game && !this.game.finished && this.game.elapsed() > 5000) {
        C.confirm('Start over?', 'Your progress on this puzzle will be lost.', 'Start over').then(function (ok) { if (ok) fresh(); });
      } else fresh();
    },

    updateHintBtn: function () {
      var H = App3.systems.hints;
      if (!this.hintBtn) return;
      if (!this.game) { this.hintBtn.disabled = true; return; }
      var left = H.remaining(this.game);
      this.hintBtn.innerHTML = '💡 Hint <span class="hint-count">' + left + '</span>';
      this.hintBtn.title = 'Hint (H) — costs ' + H.costFor(this.game.difficulty) + ' XP';
      this.hintBtn.disabled = left <= 0 || this.game.finished;
    },

    useHint: function () {
      if (!this.game || this.game.finished) return;
      var res = App3.systems.hints.request(this.game);
      App3.ui.toasts.show(res.message, {
        type: res.ok ? 'info' : 'error', icon: '💡',
        title: res.ok ? 'Hint' + (res.cost ? ' (−' + res.cost + ' XP)' : '') : null,
        duration: res.ok ? 6000 : 2500
      });
      this.updateHintBtn();
    },

    stopTimer: function () { if (this.timerId) clearInterval(this.timerId); this.timerId = null; },

    /** Central bookkeeping when a game finishes. */
    onComplete: function (game, res) {
      if (game !== this.game) return; // stale game
      var ctx = this.ctx, meta = ctx.GameClass.meta, S = App3.systems;
      this.stopTimer();
      this.updateHintBtn();
      var timeMs = game.elapsed();
      this.timerEl.textContent = utils.formatTime(timeMs);

      var result = {
        mode: meta.id, difficulty: ctx.difficulty, won: res.won, accuracy: res.accuracy,
        timeMs: timeMs, hintsUsed: game.hintsUsed, daily: !!ctx.daily, seed: game.seed, details: res.details
      };
      var prevBest = ((App3.core.storage.state.stats[meta.id] || {}).bestTime || {})[ctx.difficulty];

      S.stats.record(result);
      if (res.won) {
        var prog = App3.core.storage.state.progress;
        prog[meta.id] = prog[meta.id] || {};
        prog[meta.id][ctx.difficulty] = (prog[meta.id][ctx.difficulty] || 0) + 1;
        App3.core.storage.save();
      }
      var dailyInfo = null;
      if (ctx.daily && res.won) dailyInfo = S.daily.markDone(ctx.daily.key, ctx.daily.index);

      var reward = S.xp.computeReward(result, meta);
      var xpRes = S.xp.award(reward.total, meta.id);
      App3.core.events.emit('game:completed', { result: result });
      S.achievements.evaluate({ result: result });

      var rankEl = el('p', { class: 'muted small rank-line' });
      if (res.won) {
        S.leaderboard.submitResult(result, meta).then(function (r) {
          rankEl.textContent = 'Score ' + r.score + (r.rank ? ' · #' + r.rank + ' on the ' + S.leaderboard.getProvider().label.toLowerCase() + ' leaderboard' : '');
        }).catch(function (err) { rankEl.textContent = 'Leaderboard unavailable: ' + err.message; });
      }

      this.showResults(result, reward, xpRes, dailyInfo, rankEl, prevBest);
    },

    showResults: function (r, reward, xpRes, dailyInfo, rankEl, prevBest) {
      var self = this, ctx = this.ctx;
      var newBest = r.won && (!prevBest || r.timeMs < prevBest);
      var info = xpRes.after;
      var body = el('div', { class: 'results' }, [
        el('div', { class: 'results-emoji', 'aria-hidden': 'true' }, r.won ? (r.accuracy >= 0.999 ? '🏆' : '🎉') : '💪'),
        el('p', { class: 'results-sub' }, r.won ? 'Solved!' + (newBest ? ' New personal best!' : '') : 'Not this time — keep training!'),
        el('div', { class: 'results-grid' }, [
          C.statTile('Time', utils.formatTime(r.timeMs)),
          C.statTile('Accuracy', utils.percent(r.accuracy)),
          C.statTile('Hints', String(r.hintsUsed)),
          C.statTile('XP', '+' + reward.total)
        ]),
        el('ul', { class: 'xp-breakdown small' }, reward.parts.map(function (p) {
          return el('li', null, [el('span', null, p.label), el('span', null, '+' + p.xp)]);
        })),
        el('div', { class: 'xp-row' }, [
          C.progressBar(info.progress, 'Experience'),
          el('span', { class: 'muted small' }, 'Level ' + info.level + ' · ' + info.into + ' / ' + info.needed + ' XP')
        ]),
        xpRes.leveledUp ? el('p', { class: 'levelup-line' }, '⬆️ Level up! You reached level ' + info.level + '.') : null,
        dailyInfo && dailyInfo.newlyComplete ? el('p', { class: 'levelup-line' }, '📅 Daily challenge complete! Streak: 🔥 ' + dailyInfo.streak) : null,
        rankEl
      ]);
      var actions = [{ label: 'Home', class: 'ghost', onClick: function () { App3.ui.router.navigate('home'); } }];
      if (ctx.daily) {
        if (!r.won) actions.push({ label: 'Try again', class: 'primary', onClick: function () { self.startGame(ctx.seed); } });
      } else {
        actions.push({ label: r.won ? 'Next puzzle →' : 'Try another', class: 'primary', onClick: function () { self.startGame(RNG.randomSeed()); } });
      }
      setTimeout(function () {
        C.openModal({ title: r.won ? 'Puzzle complete' : 'Round over', body: body, actions: actions, className: 'results-modal' });
      }, 50);
    },

    destroy: function () {
      this.stopTimer();
      if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
      if (this.game) this.game.destroy();
      this.game = null;
      this.area = null;
    }
  };

  App3.ui.screens.game = GameScreen;
})(window.App3);
