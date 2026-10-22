/**
 * Forgewell Corporation & TrueProgress Global Theme & Safe Storage Manager
 * Supports Light & Dark modes with persistent choice in localStorage ('tp_theme').
 * Provides global window.TPStorage helper for data protection and recovery.
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

  var STORAGE_KEY = 'tp_theme';
  var DEFAULT_THEME = 'light';

  function getStoredTheme() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    } catch (e) {}
    return DEFAULT_THEME;
  }

  function applyTheme(theme, save) {
    if (theme !== 'dark' && theme !== 'light') {
      theme = DEFAULT_THEME;
    }

    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) {
      document.body.setAttribute('data-theme', theme);
    }

    if (save !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
        localStorage.setItem('theme', theme);
        sessionStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {}
    }

    // Update meta theme-color if present
    var metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#090d16' : '#ffffff');
    }

    updateUI(theme);

    // Dispatch event for any interested listeners
    try {
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    } catch (e) {}
  }

  function updateUI(theme) {
    var isDark = theme === 'dark';

    // Update all theme toggle buttons on the page
    var buttons = document.querySelectorAll('.theme-toggle-btn, #themeToggleBtn, .mobile-theme-btn');
    buttons.forEach(function (btn) {
      var label = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });

    // Update any dropdown text or indicator badge
    var dropdownText = document.getElementById('dropdownThemeText');
    if (dropdownText) {
      dropdownText.textContent = 'Theme';
    }
    var dropdownBadge = document.getElementById('dropdownThemeBadge');
    if (dropdownBadge) {
      dropdownBadge.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    }
  }

  // Apply immediately upon script load (before DOM rendering to avoid flash)
  var initialTheme = getStoredTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);

  // Global toggle function
  window.toggleTheme = function () {
    var current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    var next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    return next;
  };
  window.toggleTrueProgressTheme = window.toggleTheme;

  // Listen to storage changes across tabs
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY || e.key === 'theme') {
      var newTheme = e.newValue;
      if (newTheme === 'dark' || newTheme === 'light') {
        applyTheme(newTheme, false);
      }
    }
  });

  // Wire up click handlers when DOM is ready
  function initThemeControls() {
    var currentTheme = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    applyTheme(currentTheme, false);

    // Attach click listeners to all toggle buttons
    document.querySelectorAll('.theme-toggle-btn, #themeToggleBtn, .mobile-theme-btn').forEach(function (btn) {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = 'true';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.toggleTheme();
      });
    });

    // Attach click listener to dropdown theme action if present
    var dropdownToggle = document.getElementById('dropdownThemeToggleBtn');
    if (dropdownToggle && !dropdownToggle.dataset.themeBound) {
      dropdownToggle.dataset.themeBound = 'true';
      dropdownToggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.toggleTheme();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeControls);
  } else {
    initThemeControls();
  }

  // Delegated click listener as fail-safe
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.theme-toggle-btn, #themeToggleBtn, .mobile-theme-btn, #dropdownThemeToggleBtn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      window.toggleTheme();
    }
  });
})();
