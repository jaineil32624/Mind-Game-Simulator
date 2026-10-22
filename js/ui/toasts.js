/**
 * App3.ui.toasts — transient notifications, including the animated
 * achievement-unlock toast.
 */
(function (App3) {
  'use strict';

  var el = App3.core.utils.el;
  var queueDelay = 0;

  function container() { return document.getElementById('toasts'); }

  /**
   * Show a toast.
   * @param {string} message
   * @param {{type?:'info'|'success'|'error'|'xp', icon?:string, title?:string, duration?:number}} [opts]
   */
  function show(message, opts) {
    opts = opts || {};
    var root = container();
    if (!root) return null;
    var node = el('div', { class: 'toast ' + (opts.type || 'info'), role: 'status' }, [
      opts.icon ? el('span', { class: 'toast-icon', 'aria-hidden': 'true' }, opts.icon) : null,
      el('div', { class: 'toast-body' }, [
        opts.title ? el('strong', { class: 'toast-title' }, opts.title) : null,
        el('span', null, message)
      ])
    ]);
    root.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('in'); });
    var dismiss = function () {
      node.classList.remove('in');
      node.classList.add('out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 350);
    };
    node.addEventListener('click', dismiss);
    setTimeout(dismiss, opts.duration || 3200);
    return node;
  }

  /** Celebratory badge toast; staggered when several unlock at once. */
  function achievement(def) {
    var delay = queueDelay;
    queueDelay += 900;
    setTimeout(function () {
      queueDelay = Math.max(0, queueDelay - 900);
      App3.core.audio.play('achievement');
      var root = container();
      if (!root) return;
      var node = el('div', { class: 'toast achievement', role: 'status' }, [
        el('div', { class: 'badge-burst', 'aria-hidden': 'true' }, [
          el('span', { class: 'badge-icon' }, def.icon)
        ]),
        el('div', { class: 'toast-body' }, [
          el('strong', { class: 'toast-title' }, 'Achievement unlocked!'),
          el('span', { class: 'ach-name' }, def.name),
          el('span', { class: 'muted small' }, def.desc + ' (+' + App3.systems.achievements.XP_REWARD + ' XP)')
        ])
      ]);
      root.appendChild(node);
      requestAnimationFrame(function () { node.classList.add('in'); });
      setTimeout(function () {
        node.classList.remove('in');
        node.classList.add('out');
        setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 400);
      }, 4200);
    }, delay);
  }

  App3.ui.toasts = { show: show, achievement: achievement };
})(window.App3);
