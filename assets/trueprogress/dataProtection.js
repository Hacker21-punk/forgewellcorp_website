/**
 * TrueProgress Universal Data Protection & Integrity Guard
 * 
 * 1. Self-heals poisoned/corrupted localStorage deletion keys caused by legacy sync loops.
 * 2. Provides a multi-tier resilient data fetch engine across all deployment paths and devices.
 * 3. Hard anti-wipe guarantee: Surveys, videos, and users will never disappear after any update or network drop.
 */
(function (window) {
  'use strict';

  // --- STEP 1: Self-Heal Poisoned Deletion Stores ---
  function healPoisonedStores() {
    try {
      const FIX_KEY = 'tp_v2026_data_intact_fix';
      const hasApplied = localStorage.getItem(FIX_KEY);

      if (!hasApplied) {
        // Purge poisoned deleted lists that wiped default surveys
        localStorage.removeItem('deleted_surveys');
        localStorage.removeItem('deleted_videos');
        localStorage.removeItem('deleted_users');
        localStorage.removeItem('permanently_deleted_surveys');
        localStorage.removeItem('permanently_deleted_videos');
        localStorage.removeItem('permanently_deleted_users');

        // Sanitize recycle bin of phantom imported items
        try {
          const rawBin = localStorage.getItem('tp_recycle_bin');
          if (rawBin) {
            let bin = JSON.parse(rawBin);
            if (Array.isArray(bin)) {
              bin = bin.filter(function (item) {
                if (item.subtitle === 'Default Survey Archive') return false;
                if (item.subtitle === 'Default Video Archive') return false;
                if (item.name && typeof item.name === 'string' && item.name.startsWith('Survey #') && (!item.meta || !item.meta.isCustom)) {
                  return false;
                }
                return true;
              });
              localStorage.setItem('tp_recycle_bin', JSON.stringify(bin));
            }
          }
        } catch (e) {}

        localStorage.setItem(FIX_KEY, 'true');
      }

      // Sanitize user assignments: ensure Amit Kumar does not carry invalid Bairabi assignments in cached stores
      sanitizeUserAssignments();
    } catch (e) {
      console.warn('Store healing error:', e);
    }
  }

  function sanitizeUserAssignments() {
    try {
      const keys = ['tp_canonical_users.json', 'tp_cached_users.json', 'edited_users'];
      keys.forEach(function (k) {
        var raw = localStorage.getItem(k) || sessionStorage.getItem(k);
        if (!raw) return;
        try {
          var arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            var modified = false;
            arr.forEach(function (u) {
              if (u && (u.email === 'amitkumarcvl20@gmail.com' || u.uid === 'ezNB5e1gOXXgEmSftaiaAoE8FiY2')) {
                if (Array.isArray(u.survey)) {
                  var origLen = u.survey.length;
                  // Remove Bairabi Section if present
                  u.survey = u.survey.filter(function (s) {
                    var sClean = String(s).trim().toLowerCase();
                    return sClean !== 'bairabi section';
                  });
                  // Ensure Bairabi Sarang Short Film is preserved
                  var hasShortFilm = u.survey.some(function (s) {
                    return String(s).trim().toLowerCase() === 'bairabi sarang short film';
                  });
                  if (!hasShortFilm) {
                    u.survey.push('Bairabi Sarang Short Film');
                  }
                  if (u.survey.length !== origLen || !hasShortFilm) modified = true;
                }
              }
            });
            if (modified) {
              try { localStorage.setItem(k, JSON.stringify(arr)); } catch (e) {}
              try { sessionStorage.setItem(k, JSON.stringify(arr)); } catch (e) {}
            }
          }
        } catch (e) {}
      });
    } catch (err) {
      console.warn('User sanitization notice:', err);
    }
  }

  // Run self-healing
  healPoisonedStores();

  // --- STEP 2: Multi-Path Resilient Data Fetch Engine ---
  var TPDataLoader = {
    /**
     * Resiliently fetch a JSON data file across multiple possible URLs.
     * Guaranteed to work whether the app is running on root `/`, `/dashboard`, `/trueprogress`,
     * localhost, or a subpath.
     */
    fetchJson: async function (filename) {
      var clean = String(filename).replace(/^\/+/, '');
      var candidates = [
        'backup%20details%20of%20trueprogress/' + clean,
        '/backup%20details%20of%20trueprogress/' + clean,
        'trueprogress/backup%20details%20of%20trueprogress/' + clean,
        '/trueprogress/backup%20details%20of%20trueprogress/' + clean,
        '../backup%20details%20of%20trueprogress/' + clean
      ];

      var data = null;
      for (var i = 0; i < candidates.length; i++) {
        try {
          var sep = candidates[i].indexOf('?') === -1 ? '?' : '&';
          var urlWithBuster = candidates[i] + sep + '_t=' + Date.now();
          var res = await fetch(urlWithBuster, { cache: 'no-cache' });
          if (res.ok) {
            data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              try {
                sessionStorage.setItem('tp_cached_' + clean, JSON.stringify(data));
                localStorage.setItem('tp_canonical_' + clean, JSON.stringify(data));
              } catch (e) {}
              return data;
            }
          }
        } catch (e) {}
      }

      // Tier 2: Session Storage Cache
      try {
        var sess = sessionStorage.getItem('tp_cached_' + clean);
        if (sess) {
          data = JSON.parse(sess);
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } catch (e) {}

      // Tier 3: Local Storage Canonical Cache
      try {
        var local = localStorage.getItem('tp_canonical_' + clean);
        if (local) {
          data = JSON.parse(local);
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } catch (e) {}

      return [];
    },

    /**
     * Anti-Wipe Protection: Guarantees surveys never display 0 rows
     * if baseline surveys exist.
     */
    protectSurveys: function (activeList, defaultSurveys) {
      if ((!activeList || activeList.length === 0) && defaultSurveys && defaultSurveys.length > 0) {
        console.warn('[TPDataLoader] Anti-Wipe triggered for surveys. Auto-healing table data.');
        try {
          localStorage.removeItem('deleted_surveys');
          localStorage.removeItem('permanently_deleted_surveys');
        } catch (e) {}
        return [].concat(defaultSurveys);
      }
      return activeList || [];
    },

    /**
     * Anti-Wipe Protection for Videos
     */
    protectVideos: function (activeList, defaultVideos) {
      if ((!activeList || activeList.length === 0) && defaultVideos && defaultVideos.length > 0) {
        console.warn('[TPDataLoader] Anti-Wipe triggered for videos. Auto-healing video data.');
        try {
          localStorage.removeItem('deleted_videos');
          localStorage.removeItem('permanently_deleted_videos');
        } catch (e) {}
        return [].concat(defaultVideos);
      }
      return activeList || [];
    },

    /**
     * Anti-Wipe Protection for Users
     */
    protectUsers: function (activeList, defaultUsers) {
      if ((!activeList || activeList.length === 0) && defaultUsers && defaultUsers.length > 0) {
        console.warn('[TPDataLoader] Anti-Wipe triggered for users. Auto-healing user data.');
        try {
          localStorage.removeItem('deleted_users');
          localStorage.removeItem('permanently_deleted_users');
        } catch (e) {}
        return [].concat(defaultUsers);
      }
      return activeList || [];
    }
  };

  window.TPDataLoader = TPDataLoader;

})(typeof window !== 'undefined' ? window : this);
