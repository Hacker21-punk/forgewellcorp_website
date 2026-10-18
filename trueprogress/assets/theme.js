/**
 * Forgewell Corporation & TrueProgress Global Theme Manager
 * Fixed to Light Mode across all user and admin panels.
 */
(function () {
  'use strict';

  var memoryCache = {};

  // Global safe storage helper to protect all data against quota errors, corrupted JSON, and private browsing limitations
  window.TPStorage = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) {
          if (memoryCache.hasOwnProperty(key)) return memoryCache[key];
          try {
            var sRaw = sessionStorage.getItem(key);
            if (sRaw !== null && sRaw !== undefined) return JSON.parse(sRaw);
          } catch (e) {}
          return fallback;
        }
        return JSON.parse(raw);
      } catch (e) {
        try {
          var unparsed = localStorage.getItem(key);
          if (unparsed !== null && unparsed !== undefined) return unparsed;
        } catch (err) {}
        return memoryCache.hasOwnProperty(key) ? memoryCache[key] : fallback;
      }
    },
    set: function (key, val) {
      try {
        memoryCache[key] = val;
        var serialized = typeof val === 'string' ? val : JSON.stringify(val);
        localStorage.setItem(key, serialized);
        try {
          sessionStorage.setItem(key, serialized);
        } catch (sErr) {}
        return true;
      } catch (e) {
        console.warn('[TPStorage] localStorage write failed for key:', key, e);
        try {
          var serializedFallback = typeof val === 'string' ? val : JSON.stringify(val);
          sessionStorage.setItem(key, serializedFallback);
        } catch (sErr) {}
        return false;
      }
    },
    remove: function (key) {
      delete memoryCache[key];
      try {
        localStorage.removeItem(key);
      } catch (e) {}
      try {
        sessionStorage.removeItem(key);
      } catch (e) {}
    }
  };

  var DEFAULT_THEME = 'light';

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', 'light');
    if (document.body) {
      document.body.setAttribute('data-theme', 'light');
    }
    try {
      localStorage.setItem('tp_theme', 'light');
      localStorage.setItem('theme', 'light');
    } catch (e) {}

    var metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#ffffff');
    }
  }

  // Apply immediately upon script load
  applyTheme();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTheme);
  } else {
    applyTheme();
  }

  window.toggleTheme = function () {
    applyTheme();
    return 'light';
  };
  window.toggleTrueProgressTheme = window.toggleTheme;
})();
