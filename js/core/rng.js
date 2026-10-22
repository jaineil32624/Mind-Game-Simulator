/**
 * App3.core.RNG — deterministic seeded pseudo-random number generator.
 *
 * Uses mulberry32 (fast, 32-bit state, good distribution for games).
 * Seeds may be numbers or strings (strings are hashed with a cyrb53-style
 * mixer), so "2026-10-21" always yields the same daily puzzles worldwide.
 *
 * All puzzle generators MUST draw randomness only from an RNG instance they
 * receive; never Math.random(). This keeps daily challenges reproducible.
 */
(function (App3) {
  'use strict';

  /** Hash any string to an unsigned 32-bit integer. */
  function hashString(str) {
    str = String(str);
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }

  /**
   * @constructor
   * @param {number|string} seed
   */
  function RNG(seed) {
    if (typeof seed === 'string') seed = hashString(seed);
    this.seed = (seed >>> 0);
    this.state = this.seed;
  }

  /** Float in [0, 1). */
  RNG.prototype.next = function () {
    var t = (this.state = (this.state + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** Integer in [min, max] inclusive. */
  RNG.prototype.int = function (min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  };

  /** True with probability p. */
  RNG.prototype.chance = function (p) { return this.next() < p; };

  /** Random element of an array. */
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };

  /** Fisher–Yates shuffle in place; returns the array. */
  RNG.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  };

  /** Shuffled copy. */
  RNG.prototype.shuffled = function (arr) { return this.shuffle(arr.slice()); };

  /** k distinct random elements. */
  RNG.prototype.sample = function (arr, k) { return this.shuffled(arr).slice(0, k); };

  /** Pick a key from {key: weight} proportionally to weight. */
  RNG.prototype.weighted = function (weights) {
    var keys = Object.keys(weights).filter(function (k) { return weights[k] > 0; });
    var total = keys.reduce(function (s, k) { return s + weights[k]; }, 0);
    var r = this.next() * total;
    for (var i = 0; i < keys.length; i++) {
      r -= weights[keys[i]];
      if (r < 0) return keys[i];
    }
    return keys[keys.length - 1];
  };

  /** Derive an independent child generator (useful for sub-generators). */
  RNG.prototype.fork = function (label) {
    return new RNG(hashString(String(this.int(0, 0x7fffffff)) + ':' + (label || '')));
  };

  RNG.create = function (seed) { return new RNG(seed); };
  RNG.hashString = hashString;

  /** Non-deterministic 31-bit seed for normal (non-daily) play. */
  RNG.randomSeed = function () {
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        var a = new Uint32Array(1);
        crypto.getRandomValues(a);
        return (a[0] & 0x7fffffff) || 1;
      }
    } catch (e) { /* fall through */ }
    return Math.floor(Math.random() * 0x7fffffff) || 1;
  };

  App3.core.RNG = RNG;
})(window.App3);
