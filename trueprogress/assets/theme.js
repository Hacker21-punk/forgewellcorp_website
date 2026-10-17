/**
 * Forgewell Corporation & TrueProgress Global Theme Manager
 * Fixed to Light Mode across all user and admin panels.
 */
(function () {
  'use strict';

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
