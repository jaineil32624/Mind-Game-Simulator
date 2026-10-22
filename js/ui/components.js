/**
 * App3.ui.components — reusable UI building blocks: modal dialogs,
 * progress bars, difficulty picker, stat tiles.
 */
(function (App3) {
  'use strict';

  var utils = App3.core.utils;
  var el = utils.el;

  // ------------------------------------------------------------------ modal

  var stack = [];

  /**
   * Open a modal dialog.
   * @param {{title:string, body:Node|string, actions?:Array<{label, class?, onClick?, keepOpen?}>,
   *          dismissable?:boolean, className?:string, onClose?:function}} opts
   * @returns {{close:function, el:HTMLElement}}
   */
  function openModal(opts) {
    var root = document.getElementById('modal-root');
    var previouslyFocused = document.activeElement;
    var dismissable = opts.dismissable !== false;
    var handle = {};

    var body = typeof opts.body === 'string' ? el('div', { html: opts.body }) : opts.body;
    var actions = el('div', { class: 'modal-actions' });
    (opts.actions || [{ label: 'Close', class: 'primary' }]).forEach(function (a) {
      actions.appendChild(el('button', {
        class: 'btn ' + (a.class || ''), type: 'button',
        onclick: function () {
          var keep = a.onClick ? a.onClick(handle) === false || a.keepOpen : false;
          if (!keep) handle.close();
        }
      }, a.label));
    });

    var titleId = 'modal-title-' + Date.now();
    var dialog = el('div', { class: 'modal ' + (opts.className || ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, [
      el('h2', { class: 'modal-title', id: titleId }, opts.title || ''),
      el('div', { class: 'modal-body' }, body),
      actions
    ]);
    var overlay = el('div', { class: 'modal-overlay' }, dialog);
    if (dismissable) overlay.addEventListener('click', function (e) { if (e.target === overlay) handle.close(); });

    function onKey(e) {
      if (stack[stack.length - 1] !== handle) return;
      if (e.key === 'Escape' && dismissable) { e.preventDefault(); handle.close(); }
      if (e.key === 'Tab') { // simple focus trap
        var f = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);

    var closed = false;
    handle.el = dialog;
    handle.close = function () {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      overlay.classList.remove('in');
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
      var i = stack.indexOf(handle);
      if (i >= 0) stack.splice(i, 1);
      if (opts.onClose) opts.onClose();
      if (previouslyFocused && previouslyFocused.focus && document.body.contains(previouslyFocused)) previouslyFocused.focus();
    };

    root.appendChild(overlay);
    stack.push(handle);
    requestAnimationFrame(function () { overlay.classList.add('in'); });
    setTimeout(function () {
      var focusTarget = dialog.querySelector('.btn.primary') || dialog.querySelector('button');
      if (focusTarget) focusTarget.focus();
    }, 50);
    return handle;
  }

  function closeAllModals() { stack.slice().forEach(function (h) { h.close(); }); }
  function isModalOpen() { return stack.length > 0; }

  /** Promise-based confirm dialog. */
  function confirmDialog(title, message, okLabel, danger) {
    return new Promise(function (resolve) {
      var answered = false;
      openModal({
        title: title,
        body: el('p', null, message),
        actions: [
          { label: 'Cancel', class: 'ghost', onClick: function () { answered = true; resolve(false); } },
          { label: okLabel || 'OK', class: danger ? 'danger primary' : 'primary', onClick: function () { answered = true; resolve(true); } }
        ],
        onClose: function () { if (!answered) resolve(false); }
      });
    });
  }

  // ----------------------------------------------------------- small pieces

  function progressBar(value, label) {
    var pct = Math.round(utils.clamp(value || 0, 0, 1) * 100);
    return el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': label || 'Progress' },
      el('div', { class: 'progress-fill', style: { width: pct + '%' } }));
  }

  function statTile(label, value, sub) {
    return el('div', { class: 'stat-tile' }, [
      el('div', { class: 'stat-value' }, String(value)),
      el('div', { class: 'stat-label' }, label),
      sub ? el('div', { class: 'stat-sub muted small' }, sub) : null
    ]);
  }

  function difficultyChip(d) {
    return el('span', { class: 'chip diff-' + d }, App3.DIFFICULTY_LABELS[d] || d);
  }

  /** Modal for choosing a difficulty, then navigating to the game. */
  function difficultyPicker(GameClass) {
    var meta = GameClass.meta;
    var storage = App3.core.storage;
    var progress = storage.state.progress[meta.id] || {};
    var bests = (storage.state.stats[meta.id] || {}).bestTime || {};
    var grid = el('div', { class: 'diff-grid' });
    var handle;
    App3.DIFFICULTIES.forEach(function (d) {
      var level = (progress[d] || 0) + 1;
      grid.appendChild(el('button', {
        class: 'diff-btn diff-' + d, type: 'button',
        onclick: function () { handle.close(); App3.ui.router.navigate('play/' + meta.id + '/' + d); }
      }, [
        el('span', { class: 'diff-name' }, App3.DIFFICULTY_LABELS[d]),
        el('span', { class: 'diff-info muted small' }, (meta.difficultyInfo && meta.difficultyInfo[d]) || ''),
        el('span', { class: 'diff-meta small' }, 'Level ' + level + (bests[d] ? ' · best ' + utils.formatTime(bests[d]) : ''))
      ]));
    });
    handle = openModal({
      title: meta.icon + '  ' + meta.name,
      body: el('div', null, [el('p', { class: 'muted' }, meta.description), grid]),
      actions: [{ label: 'Cancel', class: 'ghost' }],
      className: 'picker'
    });
    return handle;
  }

  App3.ui.components = {
    openModal: openModal, closeAllModals: closeAllModals, isModalOpen: isModalOpen,
    confirm: confirmDialog, progressBar: progressBar, statTile: statTile,
    difficultyChip: difficultyChip, difficultyPicker: difficultyPicker
  };
})(window.App3);
