/**
 * TrueProgress Theme Manager
 * Supports Light & Dark mode with default set to Light mode.
 * Persists user choice in localStorage ('tp_theme').
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'tp_theme';
  var DEFAULT_THEME = 'light';

  function getStoredTheme() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
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

    if (save !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {}
    }

    // Update theme-color meta tag if present
    var metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#080b11' : '#f8fafc');
    }

    updateUI(theme);

    // Dispatch custom event for any listeners
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }

  function updateUI(theme) {
    var isDark = theme === 'dark';

    // Update all theme toggle buttons on the page
    var buttons = document.querySelectorAll('.theme-toggle-btn, #themeToggleBtn');
    buttons.forEach(function (btn) {
      var label = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });

    // Update dropdown item text if present
    var dropdownText = document.getElementById('dropdownThemeText');
    if (dropdownText) {
      dropdownText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }
  }

  // Apply immediately upon script load (before DOM rendering to prevent FOUC)
  var initialTheme = getStoredTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);

  // Global toggle function
  window.toggleTrueProgressTheme = function () {
    var current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    var next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    return next;
  };

  // Wire up click handlers when DOM is ready
  function initThemeControls() {
    var currentTheme = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    updateUI(currentTheme);

    // Attach click listeners to all toggle buttons
    document.querySelectorAll('.theme-toggle-btn, #themeToggleBtn').forEach(function (btn) {
      // Avoid duplicate binding
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = 'true';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.toggleTrueProgressTheme();
      });
    });

    // Attach click listener to dropdown theme action
    var dropdownToggle = document.getElementById('dropdownThemeToggleBtn');
    if (dropdownToggle && !dropdownToggle.dataset.themeBound) {
      dropdownToggle.dataset.themeBound = 'true';
      dropdownToggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.toggleTrueProgressTheme();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeControls);
  } else {
    initThemeControls();
  }
})();
