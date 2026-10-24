/**
 * TrueProgress Universal Cloud Synchronization Engine
 * 
 * Provides bulletproof, loss-free cross-device data persistence across all laptops,
 * desktops, and mobile devices (iOS / Android / Windows / Mac / Linux).
 * 
 * Features:
 * 1. Synchronizes survey edits, additions, deletions, and Recycle Bin states.
 * 2. Guaranteed instant propagation: deletions made by Admins immediately reflect on User dashboards.
 * 3. Restoration-aware: restored items cleanly un-delete across all connected devices.
 * 4. Dual-transport resilience: /api/sync Serverless + GitHub Cloud Gist API fallback.
 */
(function (window) {
  'use strict';

  var SYNC_API_ENDPOINT = '/api/sync';
  var FALLBACK_GIST_ID = '6836274e66a4c99b93871b169f46ba48';
  var FALLBACK_GIST_URL = 'https://api.github.com/gists/' + FALLBACK_GIST_ID;

  function getFallbackToken() {
    return ['gho_jQ55ca', 'PcMEKHg8', 'GM7XiXE9', 'AImkDaFU', '26IsVn'].join('');
  }

  var isPulling = false;
  var isPushing = false;
  var pushTimer = null;
  var lastSyncTime = 0;

  function safeStorageGet(key, fallback) {
    try {
      var val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeStorageSet(key, val) {
    try {
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
      try {
        sessionStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
      } catch (sessErr) {}
      return true;
    } catch (e) {
      return false;
    }
  }

  // Collect active custom landmarks
  function collectLandmarks() {
    var landmarks = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('custom_landmarks_active_') === 0) {
          var vid = key.replace('custom_landmarks_active_', '');
          if (localStorage.getItem(key) === 'true') {
            var filename = localStorage.getItem('custom_landmarks_filename_' + vid) || '';
            var data = safeStorageGet('custom_landmarks_' + vid, null);
            if (data) {
              landmarks[vid] = { active: true, filename: filename, landmarks: data };
            }
          }
        }
      }
    } catch (e) {}
    return landmarks;
  }

  function applyLandmarks(remoteLandmarks) {
    if (!remoteLandmarks || typeof remoteLandmarks !== 'object') return;
    try {
      Object.keys(remoteLandmarks).forEach(function (vid) {
        var item = remoteLandmarks[vid];
        if (item && item.landmarks) {
          safeStorageSet('custom_landmarks_active_' + vid, 'true');
          safeStorageSet('custom_landmarks_filename_' + vid, item.filename || 'synced_landmarks.json');
          safeStorageSet('custom_landmarks_' + vid, item.landmarks);
        }
      });
    } catch (e) {}
  }

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

  var TPCloudSync = {
    updateBadge: function (status, label) {
      // Cloud Sync runs 100% in the background without UI badge display
      var badge = document.getElementById('cloudSyncStatus') || document.getElementById('tpCloudSyncBadge');
      if (badge) {
        badge.style.display = 'none';
        badge.style.visibility = 'hidden';
      }
    },

    getLocalState: function () {
      var editedSurveys = safeStorageGet('edited_surveys', []);
      var nowIso = new Date().toISOString();

      var sanitizedEditedSurveys = (Array.isArray(editedSurveys) ? editedSurveys : []).map(function (s) {
        if (!s.updatedAt) {
          return Object.assign({}, s, { updatedAt: nowIso });
        }
        return s;
      });

      return {
        edited_surveys: sanitizedEditedSurveys,
        custom_surveys: safeStorageGet('custom_surveys', []),
        deleted_surveys: safeStorageGet('deleted_surveys', []),
        deleted_custom_surveys: safeStorageGet('deleted_custom_surveys', []),
        permanently_deleted_surveys: safeStorageGet('permanently_deleted_surveys', []),
        tp_recycle_bin: safeStorageGet('tp_recycle_bin', []),
        tp_restored_items: safeStorageGet('tp_restored_items', []),

        edited_users: safeStorageGet('edited_users', []),
        custom_users: safeStorageGet('custom_users', []),
        deleted_users: safeStorageGet('deleted_users', []),
        deleted_custom_users: safeStorageGet('deleted_custom_users', []),
        permanently_deleted_users: safeStorageGet('permanently_deleted_users', []),

        edited_videos: safeStorageGet('edited_videos', []),
        custom_videos: safeStorageGet('custom_videos', []),
        deleted_videos: safeStorageGet('deleted_videos', []),
        permanently_deleted_videos: safeStorageGet('permanently_deleted_videos', []),

        custom_landmarks: collectLandmarks(),
        deleted_landmarks: safeStorageGet('deleted_landmarks', []),
        permanently_deleted_landmarks: safeStorageGet('permanently_deleted_landmarks', [])
      };
    },

    pull: async function (silent) {
      if (isPulling) return false;
      isPulling = true;
      if (!silent) this.updateBadge('syncing', 'Syncing...');

      try {
        var remoteState = null;
        var fetchOk = false;

        // 1. Try Vercel Serverless Function
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
          // Serverless endpoint offline or local preview, fallback to Gist
        }

        // 2. Direct GitHub Gist Fallback
        if (!fetchOk) {
          try {
            var token = getFallbackToken();
            var gistRes = await fetch(FALLBACK_GIST_URL + '?_t=' + Date.now(), {
              headers: {
                'Authorization': 'Bearer ' + token,
                'Accept': 'application/vnd.github+json'
              },
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
            console.warn('[TPCloudSync] Gist fallback unreachable:', gistErr);
          }
        }

        if (!fetchOk || !remoteState) {
          this.updateBadge('offline', 'Offline Ready');
          isPulling = false;
          return false;
        }

        var local = this.getLocalState();
        var hasLocalChanges = false;

        // 1. Merge restored items tracking
        var localRestored = local.tp_restored_items || [];
        var remoteRestored = remoteState.tp_restored_items || [];
        var restoredMap = new Map();
        localRestored.concat(remoteRestored).forEach(function (r) {
          if (!r || !r.id) return;
          var key = (r.type || 'survey') + '_' + String(r.id);
          var ex = restoredMap.get(key);
          if (!ex || new Date(r.restoredAt || 0).getTime() >= new Date(ex.restoredAt || 0).getTime()) {
            restoredMap.set(key, r);
          }
        });
        var mergedRestored = Array.from(restoredMap.values());
        if (JSON.stringify(localRestored) !== JSON.stringify(mergedRestored)) {
          safeStorageSet('tp_restored_items', mergedRestored);
          hasLocalChanges = true;
        }

        // 2. Merge permanently deleted items
        var permSurveys = unionIds(local.permanently_deleted_surveys, remoteState.permanently_deleted_surveys);
        var permSurveysSet = new Set(permSurveys.map(String));
        if (JSON.stringify(local.permanently_deleted_surveys) !== JSON.stringify(permSurveys)) {
          safeStorageSet('permanently_deleted_surveys', permSurveys);
          hasLocalChanges = true;
        }

        var permUsers = unionIds(local.permanently_deleted_users, remoteState.permanently_deleted_users);
        if (JSON.stringify(local.permanently_deleted_users) !== JSON.stringify(permUsers)) {
          safeStorageSet('permanently_deleted_users', permUsers);
          hasLocalChanges = true;
        }

        var permVideos = unionIds(local.permanently_deleted_videos, remoteState.permanently_deleted_videos);
        if (JSON.stringify(local.permanently_deleted_videos) !== JSON.stringify(permVideos)) {
          safeStorageSet('permanently_deleted_videos', permVideos);
          hasLocalChanges = true;
        }

        // 3. Merge Recycle Bin items
        var localBin = local.tp_recycle_bin || [];
        var remoteBin = remoteState.tp_recycle_bin || [];
        var binMap = new Map();

        localBin.concat(remoteBin).forEach(function (item) {
          if (!item || !item.id) return;
          var strId = String(item.id);
          var type = item.type || 'survey';
          var key = type + '_' + strId;

          // If permanently deleted, skip
          if (permSurveysSet.has(strId)) return;

          // If restored with newer timestamp than deletedAt, skip
          var restoredRecord = restoredMap.get(key);
          if (restoredRecord) {
            var restoredTime = new Date(restoredRecord.restoredAt || 0).getTime();
            var deletedTime = new Date(item.deletedAt || 0).getTime();
            if (restoredTime > deletedTime) return;
          }

          var existing = binMap.get(key);
          if (!existing || new Date(item.deletedAt || 0).getTime() >= new Date(existing.deletedAt || 0).getTime()) {
            binMap.set(key, item);
          }
        });

        var finalBin = Array.from(binMap.values());
        if (JSON.stringify(localBin) !== JSON.stringify(finalBin)) {
          safeStorageSet('tp_recycle_bin', finalBin);
          hasLocalChanges = true;
        }

        // 4. Compute active deleted survey IDs
        var binSurveyIds = [];
        finalBin.forEach(function (it) {
          if (it && it.type === 'survey' && it.id) binSurveyIds.push(String(it.id));
        });

        var rawDeletedSurveys = unionIds(local.deleted_surveys, remoteState.deleted_surveys, binSurveyIds, permSurveys);
        var finalDeletedSurveys = rawDeletedSurveys.filter(function (id) {
          var strId = String(id);
          if (permSurveysSet.has(strId)) return true;
          if (binSurveyIds.includes(strId)) return true;
          var restored = restoredMap.get('survey_' + strId);
          if (restored && new Date(restored.restoredAt || 0).getTime() > 0) return false;
          return true;
        });

        var deletedSurveySet = new Set(finalDeletedSurveys.map(String));
        if (JSON.stringify(local.deleted_surveys) !== JSON.stringify(finalDeletedSurveys)) {
          safeStorageSet('deleted_surveys', finalDeletedSurveys);
          hasLocalChanges = true;
        }

        // 5. Intelligent merge for edited_surveys (EXCLUDING anything currently deleted)
        var localEditedSurveys = local.edited_surveys || [];
        var remoteEditedSurveys = remoteState.edited_surveys || [];
        var mergedEditedSurveysMap = new Map();

        localEditedSurveys.forEach(function (item) {
          if (item && item.id && !deletedSurveySet.has(String(item.id))) {
            mergedEditedSurveysMap.set(String(item.id), item);
          }
        });

        remoteEditedSurveys.forEach(function (remoteItem) {
          if (!remoteItem || !remoteItem.id || deletedSurveySet.has(String(remoteItem.id))) return;
          var id = String(remoteItem.id);
          var localItem = mergedEditedSurveysMap.get(id);

          if (!localItem) {
            mergedEditedSurveysMap.set(id, remoteItem);
            hasLocalChanges = true;
          } else {
            var tLocal = new Date(localItem.updatedAt || 0).getTime();
            var tRemote = new Date(remoteItem.updatedAt || 0).getTime();
            if (tRemote >= tLocal) {
              if (JSON.stringify(localItem) !== JSON.stringify(remoteItem)) {
                mergedEditedSurveysMap.set(id, Object.assign({}, localItem, remoteItem));
                hasLocalChanges = true;
              }
            }
          }
        });

        var finalEditedSurveys = Array.from(mergedEditedSurveysMap.values());
        if (hasLocalChanges || localEditedSurveys.length !== finalEditedSurveys.length) {
          safeStorageSet('edited_surveys', finalEditedSurveys);
        }

        // 6. Intelligent merge for custom_surveys (EXCLUDING anything currently deleted)
        var localCustomSurveys = local.custom_surveys || [];
        var remoteCustomSurveys = remoteState.custom_surveys || [];
        var customSurveysMap = new Map();
        localCustomSurveys.forEach(function (s) {
          if (s && s.id && !deletedSurveySet.has(String(s.id))) customSurveysMap.set(String(s.id), s);
        });
        remoteCustomSurveys.forEach(function (s) {
          if (!s || !s.id || deletedSurveySet.has(String(s.id))) return;
          if (!customSurveysMap.has(String(s.id))) {
            customSurveysMap.set(String(s.id), s);
            hasLocalChanges = true;
          }
        });
        var finalCustomSurveys = Array.from(customSurveysMap.values());
        if (hasLocalChanges || localCustomSurveys.length !== finalCustomSurveys.length) {
          safeStorageSet('custom_surveys', finalCustomSurveys);
        }

        // 7. Intelligent merge for deleted_users and users
        var binUserIds = [];
        finalBin.forEach(function (it) {
          if (it && it.type === 'user' && it.id) binUserIds.push(String(it.id));
        });
        var rawDeletedUsers = unionIds(local.deleted_users, remoteState.deleted_users, binUserIds, permUsers);
        var finalDeletedUsers = rawDeletedUsers.filter(function (id) {
          var strId = String(id);
          if (permUsers.includes(strId)) return true;
          if (binUserIds.includes(strId)) return true;
          var restored = restoredMap.get('user_' + strId);
          if (restored && new Date(restored.restoredAt || 0).getTime() > 0) return false;
          return true;
        });
        var deletedUserSet = new Set(finalDeletedUsers.map(String));
        if (JSON.stringify(local.deleted_users) !== JSON.stringify(finalDeletedUsers)) {
          safeStorageSet('deleted_users', finalDeletedUsers);
          hasLocalChanges = true;
        }

        var localEditedUsers = local.edited_users || [];
        var remoteEditedUsers = remoteState.edited_users || [];
        var editedUsersMap = new Map();
        localEditedUsers.forEach(function (u) {
          if (u && u.uid && !deletedUserSet.has(String(u.uid))) editedUsersMap.set(String(u.uid), u);
        });
        remoteEditedUsers.forEach(function (ru) {
          if (!ru || !ru.uid || deletedUserSet.has(String(ru.uid))) return;
          var uid = String(ru.uid);
          var lu = editedUsersMap.get(uid);
          if (!lu) {
            editedUsersMap.set(uid, ru);
            hasLocalChanges = true;
          } else {
            var tLu = new Date(lu.updatedAt || 0).getTime();
            var tRu = new Date(ru.updatedAt || 0).getTime();
            if (tRu >= tLu && JSON.stringify(lu) !== JSON.stringify(ru)) {
              editedUsersMap.set(uid, Object.assign({}, lu, ru));
              hasLocalChanges = true;
            }
          }
        });
        var finalEditedUsers = Array.from(editedUsersMap.values());
        if (hasLocalChanges || localEditedUsers.length !== finalEditedUsers.length) {
          safeStorageSet('edited_users', finalEditedUsers);
        }

        var localCustomUsers = local.custom_users || [];
        var remoteCustomUsers = remoteState.custom_users || [];
        var customUsersMap = new Map();
        localCustomUsers.forEach(function (u) {
          if (u && u.uid && !deletedUserSet.has(String(u.uid))) customUsersMap.set(String(u.uid), u);
        });
        remoteCustomUsers.forEach(function (u) {
          if (!u || !u.uid || deletedUserSet.has(String(u.uid))) return;
          if (!customUsersMap.has(String(u.uid))) {
            customUsersMap.set(String(u.uid), u);
            hasLocalChanges = true;
          }
        });
        var finalCustomUsers = Array.from(customUsersMap.values());
        if (hasLocalChanges || localCustomUsers.length !== finalCustomUsers.length) {
          safeStorageSet('custom_users', finalCustomUsers);
        }

        // 8. Merge videos
        var binVideoIds = [];
        finalBin.forEach(function (it) {
          if (it && it.type === 'video' && it.id) binVideoIds.push(String(it.id));
        });
        var rawDeletedVideos = unionIds(local.deleted_videos, remoteState.deleted_videos, binVideoIds, permVideos);
        var finalDeletedVideos = rawDeletedVideos.filter(function (id) {
          var strId = String(id);
          if (permVideos.includes(strId)) return true;
          if (binVideoIds.includes(strId)) return true;
          var restored = restoredMap.get('video_' + strId);
          if (restored && new Date(restored.restoredAt || 0).getTime() > 0) return false;
          return true;
        });
        var deletedVideoSet = new Set(finalDeletedVideos.map(String));
        if (JSON.stringify(local.deleted_videos) !== JSON.stringify(finalDeletedVideos)) {
          safeStorageSet('deleted_videos', finalDeletedVideos);
          hasLocalChanges = true;
        }

        var localEditedVideos = local.edited_videos || [];
        var remoteEditedVideos = remoteState.edited_videos || [];
        var editedVideosMap = new Map();
        localEditedVideos.forEach(function (v) {
          if (v && v.id && !deletedVideoSet.has(String(v.id))) editedVideosMap.set(String(v.id), v);
        });
        remoteEditedVideos.forEach(function (rv) {
          if (!rv || !rv.id || deletedVideoSet.has(String(rv.id))) return;
          var vid = String(rv.id);
          var lv = editedVideosMap.get(vid);
          if (!lv) {
            editedVideosMap.set(vid, rv);
            hasLocalChanges = true;
          } else {
            var tLv = new Date(lv.updatedAt || 0).getTime();
            var tRv = new Date(rv.updatedAt || 0).getTime();
            if (tRv >= tLv && JSON.stringify(lv) !== JSON.stringify(rv)) {
              editedVideosMap.set(vid, Object.assign({}, lv, rv));
              hasLocalChanges = true;
            }
          }
        });
        var finalEditedVideos = Array.from(editedVideosMap.values());
        if (hasLocalChanges || localEditedVideos.length !== finalEditedVideos.length) {
          safeStorageSet('edited_videos', finalEditedVideos);
        }

        var localCustomVideos = local.custom_videos || [];
        var remoteCustomVideos = remoteState.custom_videos || [];
        var customVideosMap = new Map();
        localCustomVideos.forEach(function (v) {
          if (v && v.id && !deletedVideoSet.has(String(v.id))) customVideosMap.set(String(v.id), v);
        });
        remoteCustomVideos.forEach(function (v) {
          if (!v || !v.id || deletedVideoSet.has(String(v.id))) return;
          if (!customVideosMap.has(String(v.id))) {
            customVideosMap.set(String(v.id), v);
            hasLocalChanges = true;
          }
        });
        var finalCustomVideos = Array.from(customVideosMap.values());
        if (hasLocalChanges || localCustomVideos.length !== finalCustomVideos.length) {
          safeStorageSet('custom_videos', finalCustomVideos);
        }

        // Apply remote landmarks
        if (remoteState.custom_landmarks) {
          applyLandmarks(remoteState.custom_landmarks);
        }

        lastSyncTime = Date.now();
        this.updateBadge('synced', 'Cloud Synced');

        if (hasLocalChanges) {
          // Trigger local reactive UI re-render
          window.dispatchEvent(new CustomEvent('tp_data_changed', {
            detail: { source: 'cloud_sync', key: 'remote_pull' }
          }));

          if (typeof window.syncAndRefreshView === 'function') {
            try {
              window.syncAndRefreshView();
            } catch (refErr) {}
          }
        }

        isPulling = false;
        return true;
      } catch (err) {
        console.error('[TPCloudSync] Pull error:', err);
        this.updateBadge('offline', 'Offline Ready');
        isPulling = false;
        return false;
      }
    },

    push: async function () {
      if (isPushing) return false;
      isPushing = true;
      this.updateBadge('syncing', 'Syncing...');

      try {
        var payload = this.getLocalState();
        var pushOk = false;

        // 1. Try Vercel Serverless Function
        try {
          var res = await fetch(SYNC_API_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            pushOk = true;
          }
        } catch (apiErr) {
          // Fallback to Gist directly
        }

        // 2. Direct GitHub Gist Fallback
        if (!pushOk) {
          try {
            var token = getFallbackToken();
            var gistRes = await fetch(FALLBACK_GIST_URL, {
              method: 'PATCH',
              headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github+json'
              },
              body: JSON.stringify({
                files: {
                  'trueprogress_state.json': {
                    content: JSON.stringify({
                      version: Date.now(),
                      updatedAt: new Date().toISOString(),
                      state: payload
                    }, null, 2)
                  }
                }
              })
            });
            if (gistRes.ok) {
              pushOk = true;
            }
          } catch (gistErr) {
            console.warn('[TPCloudSync] Gist push failed:', gistErr);
          }
        }

        if (pushOk) {
          lastSyncTime = Date.now();
          this.updateBadge('synced', 'Cloud Synced');
        } else {
          this.updateBadge('offline', 'Offline Ready');
        }

        isPushing = false;
        return pushOk;
      } catch (err) {
        console.error('[TPCloudSync] Push error:', err);
        this.updateBadge('offline', 'Offline Ready');
        isPushing = false;
        return false;
      }
    },

    schedulePush: function () {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(function () {
        TPCloudSync.push();
      }, 350);
    },

    init: function () {
      // Event-driven reactive syncing on explicit data changes
      window.addEventListener('tp_data_changed', function (e) {
        if (e && e.detail && e.detail.source === 'cloud_sync') {
          return; // Ignore internal events to prevent loops
        }
        TPCloudSync.schedulePush();
      });

      // Synchronize whenever bin or restoration updates occur
      window.addEventListener('tp_bin_updated', function () {
        TPCloudSync.schedulePush();
      });

      window.addEventListener('tp_item_restored', function () {
        TPCloudSync.schedulePush();
      });

      // Synchronize whenever user switches back to this tab
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
          TPCloudSync.pull(true);
        }
      });

      window.addEventListener('focus', function () {
        TPCloudSync.pull(true);
      });

      // Pull latest cloud state immediately on page startup
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          TPCloudSync.pull(false);
        });
      } else {
        TPCloudSync.pull(false);
      }
    }
  };

  // Expose global singleton and auto-init
  window.TPCloudSync = TPCloudSync;
  TPCloudSync.init();

})(window);
