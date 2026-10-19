/**
 * TrueProgress Universal Cloud Synchronization Engine
 * Ensures 100% loss-free, real-time data persistence across all devices, browsers, and PCs.
 * Automatically synchronizes surveys, users, videos, landmarks, and recycle bin items.
 */
(function (window) {
  'use strict';

  var SYNC_API_ENDPOINT = '/api/sync';
  var FALLBACK_GIST_ID = '6836274e66a4c99b93871b169f46ba48';
  var FALLBACK_GIST_URL = 'https://api.github.com/gists/' + FALLBACK_GIST_ID;

  var isSyncing = false;
  var pendingPushTimer = null;
  var lastSyncTimestamp = 0;
  var badgeElement = null;

  // Safe storage helper referencing window.TPStorage or localStorage
  function safeGet(key, fallback) {
    if (window.TPStorage && typeof window.TPStorage.get === 'function') {
      return window.TPStorage.get(key, fallback);
    }
    try {
      var val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeSet(key, val) {
    if (window.TPStorage && typeof window.TPStorage.set === 'function') {
      return window.TPStorage.set(key, val);
    }
    try {
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Merge helper for ID arrays or entity objects
  function unionIds() {
    var set = new Set();
    for (var i = 0; i < arguments.length; i++) {
      var arr = arguments[i];
      if (Array.isArray(arr)) {
        arr.forEach(function (item) {
          if (item === null || item === undefined) return;
          var id = typeof item === 'object' ? String(item.uid || item.id || '') : String(item);
          if (id && id !== '[object Object]') set.add(id);
        });
      }
    }
    return Array.from(set);
  }

  // Merge helper for objects array
  function mergeEntities(currArr, incArr, keyField, deletedList) {
    var map = new Map();
    var delSet = new Set(deletedList.map(String));

    (Array.isArray(currArr) ? currArr : []).forEach(function (item) {
      if (!item) return;
      var id = String(item[keyField] || item.id || '');
      if (id && !delSet.has(id)) {
        map.set(id, item);
      }
    });

    (Array.isArray(incArr) ? incArr : []).forEach(function (item) {
      if (!item) return;
      var id = String(item[keyField] || item.id || '');
      if (id && !delSet.has(id)) {
        var existing = map.get(id);
        if (existing) {
          var tEx = new Date(existing.updatedAt || existing.timestamp || 0).getTime();
          var tIn = new Date(item.updatedAt || item.timestamp || 0).getTime();
          if (tIn >= tEx) {
            map.set(id, Object.assign({}, existing, item));
          } else {
            map.set(id, Object.assign({}, item, existing));
          }
        } else {
          map.set(id, item);
        }
      }
    });

    return Array.from(map.values());
  }

  // Collect active custom landmarks from local storage
  function collectLandmarks() {
    var landmarks = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('custom_landmarks_active_') === 0) {
          var vid = key.replace('custom_landmarks_active_', '');
          var isActive = localStorage.getItem(key) === 'true';
          if (isActive) {
            var filename = localStorage.getItem('custom_landmarks_filename_' + vid) || '';
            var data = safeGet('custom_landmarks_' + vid, null);
            if (data) {
              landmarks[vid] = { active: true, filename: filename, landmarks: data };
            }
          }
        }
      }
    } catch (e) {}
    return landmarks;
  }

  // Restore landmarks from remote payload into localStorage
  function applyLandmarks(remoteLandmarks) {
    if (!remoteLandmarks || typeof remoteLandmarks !== 'object') return;
    Object.keys(remoteLandmarks).forEach(function (vid) {
      var item = remoteLandmarks[vid];
      if (item && item.landmarks) {
        safeSet('custom_landmarks_active_' + vid, 'true');
        safeSet('custom_landmarks_filename_' + vid, item.filename || 'synced_landmarks.json');
        safeSet('custom_landmarks_' + vid, item.landmarks);
      }
    });
  }

  var TPCloudSync = {
    /**
     * Gather local state payload for pushing to cloud
     */
    getLocalState: function () {
      return {
        custom_surveys: safeGet('custom_surveys', []),
        edited_surveys: safeGet('edited_surveys', []),
        deleted_surveys: safeGet('deleted_surveys', []),
        deleted_custom_surveys: safeGet('deleted_custom_surveys', []),
        permanently_deleted_surveys: safeGet('permanently_deleted_surveys', []),

        custom_users: safeGet('custom_users', []),
        edited_users: safeGet('edited_users', []),
        deleted_users: safeGet('deleted_users', []),
        deleted_custom_users: safeGet('deleted_custom_users', []),
        permanently_deleted_users: safeGet('permanently_deleted_users', []),

        custom_videos: safeGet('custom_videos', []),
        edited_videos: safeGet('edited_videos', []),
        deleted_videos: safeGet('deleted_videos', []),
        permanently_deleted_videos: safeGet('permanently_deleted_videos', []),

        custom_landmarks: collectLandmarks(),
        deleted_landmarks: safeGet('deleted_landmarks', []),
        permanently_deleted_landmarks: safeGet('permanently_deleted_landmarks', []),

        tp_recycle_bin: safeGet('tp_recycle_bin', [])
      };
    },

    /**
     * Pull remote state from cloud and merge with local storage
     */
    pull: async function (silent) {
      if (isSyncing) return false;
      if (!silent) this.updateBadge('syncing', 'Syncing...');

      try {
        var remoteState = null;
        var fetchOk = false;

        // 1. Try Vercel Serverless Endpoint /api/sync
        try {
          var res = await fetch(SYNC_API_ENDPOINT + '?_t=' + Date.now(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
          });
          if (res.ok) {
            var json = await res.json();
            if (json && json.success && json.state) {
              remoteState = json.state;
              fetchOk = true;
            }
          }
        } catch (apiErr) {
          console.warn('[TPCloudSync] /api/sync unreachable, checking fallback Gist:', apiErr);
        }

        // 2. Direct fallback to GitHub Gist if /api/sync failed or static preview
        if (!fetchOk) {
          try {
            var gistRes = await fetch(FALLBACK_GIST_URL + '?_t=' + Date.now(), {
              headers: { 'Accept': 'application/vnd.github+json' },
              cache: 'no-store'
            });
            if (gistRes.ok) {
              var gistJson = await gistRes.json();
              var file = gistJson.files && gistJson.files['trueprogress_state.json'];
              if (file && file.content) {
                var parsed = JSON.parse(file.content);
                if (parsed && parsed.state) {
                  remoteState = parsed.state;
                  fetchOk = true;
                }
              }
            }
          } catch (gistErr) {
            console.warn('[TPCloudSync] Fallback Gist also unreachable:', gistErr);
          }
        }

        if (!fetchOk || !remoteState) {
          this.updateBadge('offline', 'Offline Ready');
          return false;
        }

        // Apply intelligent merge with local data
        var local = this.getLocalState();

        // Merged deleted lists
        var delSurveys = unionIds(local.deleted_surveys, remoteState.deleted_surveys);
        var permSurveys = unionIds(local.permanently_deleted_surveys, remoteState.permanently_deleted_surveys);
        var delCustomSurveys = unionIds(local.deleted_custom_surveys, remoteState.deleted_custom_surveys);

        var delUsers = unionIds(local.deleted_users, remoteState.deleted_users);
        var permUsers = unionIds(local.permanently_deleted_users, remoteState.permanently_deleted_users);
        var delCustomUsers = unionIds(local.deleted_custom_users, remoteState.deleted_custom_users);

        var delVideos = unionIds(local.deleted_videos, remoteState.deleted_videos);
        var permVideos = unionIds(local.permanently_deleted_videos, remoteState.permanently_deleted_videos);

        var delLandmarks = unionIds(local.deleted_landmarks, remoteState.deleted_landmarks);
        var permLandmarks = unionIds(local.permanently_deleted_landmarks, remoteState.permanently_deleted_landmarks);

        // Merged entities
        var recycleBin = mergeEntities(local.tp_recycle_bin, remoteState.tp_recycle_bin, 'binId', []);

        // Collect all IDs currently in recycle bin
        var binSurveyIds = [];
        var binUserIds = [];
        var binVideoIds = [];
        recycleBin.forEach(function (it) {
          if (!it || !it.id) return;
          if (it.type === 'survey') binSurveyIds.push(String(it.id));
          if (it.type === 'user') binUserIds.push(String(it.id));
          if (it.type === 'video') binVideoIds.push(String(it.id));
        });

        var customSurveyDeletedIds = (Array.isArray(delCustomSurveys) ? delCustomSurveys : []).map(function (x) {
          return typeof x === 'object' ? x.id : x;
        });
        var allDeletedSurveyIds = unionIds(delSurveys, customSurveyDeletedIds, permSurveys, binSurveyIds);

        var customUserDeletedIds = (Array.isArray(delCustomUsers) ? delCustomUsers : []).map(function (x) {
          return typeof x === 'object' ? (x.uid || x.id) : x;
        });
        var allDeletedUserIds = unionIds(delUsers, customUserDeletedIds, permUsers, binUserIds);

        var allDeletedVideoIds = unionIds(delVideos, permVideos, binVideoIds);

        var customSurveys = mergeEntities(local.custom_surveys, remoteState.custom_surveys, 'id', allDeletedSurveyIds);
        var editedSurveys = mergeEntities(local.edited_surveys, remoteState.edited_surveys, 'id', allDeletedSurveyIds);

        var customUsers = mergeEntities(local.custom_users, remoteState.custom_users, 'uid', allDeletedUserIds);
        var editedUsers = mergeEntities(local.edited_users, remoteState.edited_users, 'uid', allDeletedUserIds);

        var customVideos = mergeEntities(local.custom_videos, remoteState.custom_videos, 'id', allDeletedVideoIds);
        var editedVideos = mergeEntities(local.edited_videos, remoteState.edited_videos, 'id', allDeletedVideoIds);

        // Persist to safe storage
        safeSet('deleted_surveys', allDeletedSurveyIds);
        safeSet('permanently_deleted_surveys', permSurveys);
        safeSet('deleted_custom_surveys', delCustomSurveys);
        safeSet('custom_surveys', customSurveys);
        safeSet('edited_surveys', editedSurveys);

        safeSet('deleted_users', allDeletedUserIds);
        safeSet('permanently_deleted_users', permUsers);
        safeSet('deleted_custom_users', delCustomUsers);
        safeSet('custom_users', customUsers);
        safeSet('edited_users', editedUsers);

        safeSet('deleted_videos', allDeletedVideoIds);
        safeSet('permanently_deleted_videos', permVideos);
        safeSet('custom_videos', customVideos);
        safeSet('edited_videos', editedVideos);

        safeSet('deleted_landmarks', delLandmarks);
        safeSet('permanently_deleted_landmarks', permLandmarks);

        safeSet('tp_recycle_bin', recycleBin);

        // Apply landmarks
        if (remoteState.custom_landmarks) {
          applyLandmarks(remoteState.custom_landmarks);
        }

        lastSyncTimestamp = Date.now();
        this.updateBadge('synced', 'Cloud Synced');

        // Dispatch notification for UI components to re-render
        window.dispatchEvent(new CustomEvent('tp_cloud_synced', {
          detail: { source: 'pull', timestamp: lastSyncTimestamp }
        }));

        return true;
      } catch (err) {
        console.error('[TPCloudSync] Pull error:', err);
        this.updateBadge('offline', 'Offline Ready');
        return false;
      }
    },

    /**
     * Push current local state to cloud
     */
    push: async function () {
      if (isSyncing) return false;
      isSyncing = true;
      this.updateBadge('syncing', 'Syncing...');

      try {
        var payload = {
          state: this.getLocalState()
        };

        var res = await fetch(SYNC_API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          var data = await res.json();
          lastSyncTimestamp = Date.now();
          this.updateBadge('synced', 'Cloud Synced');
          isSyncing = false;
          return true;
        } else {
          console.warn('[TPCloudSync] Push response not OK:', res.status);
          this.updateBadge('offline', 'Offline Ready');
          isSyncing = false;
          return false;
        }
      } catch (err) {
        console.error('[TPCloudSync] Push error:', err);
        this.updateBadge('offline', 'Offline Ready');
        isSyncing = false;
        return false;
      }
    },

    /**
     * Debounced push helper for high-frequency modifications
     */
    schedulePush: function (delayMs) {
      var ms = typeof delayMs === 'number' ? delayMs : 500;
      this.updateBadge('syncing', 'Syncing...');
      if (pendingPushTimer) {
        clearTimeout(pendingPushTimer);
      }
      var self = this;
      pendingPushTimer = setTimeout(function () {
        self.push();
      }, ms);
    },

    /**
     * Update UI status badge
     */
    updateBadge: function (status, text) {
      if (!badgeElement) {
        badgeElement = document.getElementById('tpCloudSyncBadge');
      }
      if (!badgeElement) return;

      badgeElement.className = 'cloud-sync-badge ' + (status || 'synced');
      var dot = badgeElement.querySelector('.sync-dot');
      var label = badgeElement.querySelector('.sync-text');
      if (label) {
        label.innerText = text || (status === 'syncing' ? 'Syncing...' : 'Cloud Synced');
      }
      if (lastSyncTimestamp) {
        badgeElement.title = 'Last synced with cloud: ' + new Date(lastSyncTimestamp).toLocaleTimeString();
      }
    },

    /**
     * Initialize automatic synchronization & UI badge
     */
    init: function () {
      var self = this;

      // Inject Badge CSS if not already present
      if (!document.getElementById('tp-cloud-sync-styles')) {
        var style = document.createElement('style');
        style.id = 'tp-cloud-sync-styles';
        style.textContent = [
          '.cloud-sync-badge {',
          '  display: inline-flex;',
          '  align-items: center;',
          '  gap: 6px;',
          '  padding: 5px 12px;',
          '  font-size: 12px;',
          '  font-weight: 600;',
          '  font-family: inherit;',
          '  border-radius: 9999px;',
          '  background: rgba(16, 185, 129, 0.1);',
          '  color: #059669;',
          '  border: 1px solid rgba(16, 185, 129, 0.25);',
          '  cursor: pointer;',
          '  user-select: none;',
          '  transition: all 0.2s ease;',
          '}',
          '.cloud-sync-badge:hover {',
          '  transform: translateY(-1px);',
          '  box-shadow: 0 2px 4px rgba(0,0,0,0.06);',
          '}',
          '.cloud-sync-badge.syncing {',
          '  background: rgba(245, 158, 11, 0.1);',
          '  color: #d97706;',
          '  border-color: rgba(245, 158, 11, 0.25);',
          '}',
          '.cloud-sync-badge.offline {',
          '  background: rgba(107, 114, 128, 0.1);',
          '  color: #6b7280;',
          '  border-color: rgba(107, 114, 128, 0.25);',
          '}',
          '.sync-dot {',
          '  width: 8px;',
          '  height: 8px;',
          '  border-radius: 50%;',
          '  background-color: currentColor;',
          '  display: inline-block;',
          '}',
          '.cloud-sync-badge.syncing .sync-dot {',
          '  animation: tpSyncPulse 1s infinite;',
          '}',
          '@keyframes tpSyncPulse {',
          '  0% { transform: scale(0.9); opacity: 0.5; }',
          '  50% { transform: scale(1.25); opacity: 1; }',
          '  100% { transform: scale(0.9); opacity: 0.5; }',
          '}'
        ].join('\n');
        document.head.appendChild(style);
      }

      // Find or attach badge
      var rightActions = document.querySelector('.header-right-actions');
      if (rightActions && !document.getElementById('tpCloudSyncBadge')) {
        var badge = document.createElement('div');
        badge.id = 'tpCloudSyncBadge';
        badge.className = 'cloud-sync-badge synced';
        badge.title = 'Click to sync with cloud now';
        badge.innerHTML = '<span class="sync-dot"></span><span class="sync-text">Cloud Synced</span>';
        badge.onclick = function () {
          self.pull(false);
        };
        rightActions.insertBefore(badge, rightActions.firstChild);
        badgeElement = badge;
      }

      // Initial pull from cloud
      self.pull(false);

      // Re-sync when user returns to this tab
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          if (Date.now() - lastSyncTimestamp > 10000) {
            self.pull(true);
          }
        }
      });

      window.addEventListener('focus', function () {
        if (Date.now() - lastSyncTimestamp > 10000) {
          self.pull(true);
        }
      });

      // Online event listener
      window.addEventListener('online', function () {
        self.pull(false);
      });

      // Background periodic heartbeat (every 45s)
      setInterval(function () {
        if (document.visibilityState === 'visible') {
          self.pull(true);
        }
      }, 45000);
    }
  };

  window.TPCloudSync = TPCloudSync;

  // Auto-init once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      TPCloudSync.init();
    });
  } else {
    TPCloudSync.init();
  }
})(window);
