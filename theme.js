/**
 * Forgewell Corporation & TrueProgress Global Theme Manager
 * Supports Light & Dark mode with default set to Light mode.
 * Persists user choice in localStorage ('tp_theme').
 */
(function () {
  'use strict';

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
      } catch (e) {}
    }

    // Update meta theme-color if present
    var metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0b111e' : '#ffffff');
    }

    updateUI(theme);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
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

    // Update any dropdown text or indicator
    var dropdownText = document.getElementById('dropdownThemeText');
    if (dropdownText) {
      dropdownText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
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
})();
