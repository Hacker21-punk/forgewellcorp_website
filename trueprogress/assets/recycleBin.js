/**
 * TrueProgress Universal Recycle Bin & Multi-Entity Restore Manager
 * Handles soft deletion, persistent tracking, and 100% loss-free restoration
 * for Surveys, Users, Videos, and Landmarks across TrueProgress.
 */
(function (window) {
  'use strict';

  var STORAGE_BIN = 'tp_recycle_bin';

  var STORAGE_CUSTOM_SURVEYS = 'custom_surveys';
  var STORAGE_DELETED_SURVEYS = 'deleted_surveys';
  var STORAGE_DELETED_CUSTOM_SURVEYS = 'deleted_custom_surveys';
  var STORAGE_PERM_DELETED_SURVEYS = 'permanently_deleted_surveys';
  var STORAGE_EDITED_SURVEYS = 'edited_surveys';

  var STORAGE_CUSTOM_USERS = 'custom_users';
  var STORAGE_DELETED_USERS = 'deleted_users';
  var STORAGE_DELETED_CUSTOM_USERS = 'deleted_custom_users';
  var STORAGE_EDITED_USERS = 'edited_users';
  var STORAGE_PERM_DELETED_USERS = 'permanently_deleted_users';

  var STORAGE_CUSTOM_VIDEOS = 'custom_videos';
  var STORAGE_DELETED_VIDEOS = 'deleted_videos';
  var STORAGE_EDITED_VIDEOS = 'edited_videos';
  var STORAGE_PERM_DELETED_VIDEOS = 'permanently_deleted_videos';

  var STORAGE_DELETED_LANDMARKS = 'deleted_landmarks';
  var STORAGE_PERM_DELETED_LANDMARKS = 'permanently_deleted_landmarks';

  function safeJsonParse(val, fallback) {
    if (!val) return fallback;
    try {
      return JSON.parse(val);
    } catch (e) {
      return fallback;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(isoStr) {
    if (!isoStr) return 'N/A';
    try {
      var d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      var day = String(d.getDate()).padStart(2, '0');
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var month = months[d.getMonth()];
      var year = d.getFullYear();
      var hours = String(d.getHours()).padStart(2, '0');
      var mins = String(d.getMinutes()).padStart(2, '0');
      return day + ' ' + month + ' ' + year + ', ' + hours + ':' + mins;
    } catch (e) {
      return isoStr;
    }
  }

  var TrueProgressBin = {
    // Current active filter for the modal UI
    activeFilter: 'all',

    getBinItems: function () {
      var raw = localStorage.getItem(STORAGE_BIN);
      var items = safeJsonParse(raw, []);
      items.sort(function (a, b) {
        var tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
        var tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
        return tB - tA;
      });
      return items;
    },

    saveBinItems: function (items) {
      localStorage.setItem(STORAGE_BIN, JSON.stringify(items || []));
      try {
        sessionStorage.setItem(STORAGE_BIN, JSON.stringify(items || []));
      } catch (e) {}
      window.dispatchEvent(new CustomEvent('tp_bin_updated', { detail: { items: items } }));
      window.dispatchEvent(new CustomEvent('tp_data_changed', { detail: { key: 'tp_recycle_bin' } }));
    },

    /**
     * Get all deleted IDs of a given type from both the active bin and permanent delete stores.
     * Guaranteed to never leak deleted items into platform tables.
     */
    getDeletedIds: function (type) {
      var items = this.getBinItems();
      var set = new Set();

      // IDs from the current recycle bin
      items.forEach(function (it) {
        if (it.type === type && it.id) {
          set.add(String(it.id));
        }
      });

      // IDs from explicit deletion tracking keys
      if (type === 'survey') {
        var delSurveys = safeJsonParse(localStorage.getItem(STORAGE_DELETED_SURVEYS), []);
        delSurveys.forEach(function (id) { set.add(String(id)); });
        var permSurveys = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_SURVEYS), []);
        permSurveys.forEach(function (id) { set.add(String(id)); });
      } else if (type === 'user') {
        var delUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_USERS), []);
        delUsers.forEach(function (uid) { set.add(String(uid)); });
        var permUsers = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_USERS), []);
        permUsers.forEach(function (uid) { set.add(String(uid)); });
      } else if (type === 'video') {
        var delVideos = safeJsonParse(localStorage.getItem(STORAGE_DELETED_VIDEOS), []);
        delVideos.forEach(function (id) { set.add(String(id)); });
        var permVideos = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_VIDEOS), []);
        permVideos.forEach(function (id) { set.add(String(id)); });
      }

      return Array.from(set);
    },

    isDeleted: function (type, id) {
      if (!id) return false;
      var strId = String(id);
      var deletedIds = this.getDeletedIds(type);
      return deletedIds.indexOf(strId) > -1;
    },

    /**
     * Check if a specific landmark is in the recycle bin or permanently deleted
     */
    isLandmarkDeleted: function (videoId, lm) {
      if (!videoId || !lm) return false;
      var items = this.getBinItems();
      var lmName = (lm.name || lm.display || '').trim().toLowerCase();
      var lmTime = parseFloat(lm.time) || 0;

      // Check bin items
      var inBin = items.some(function (it) {
        if (it.type !== 'landmark') return false;
        var itVidId = (it.meta && it.meta.videoId) || (it.data && it.data.videoId);
        if (itVidId && itVidId !== videoId) return false;
        var itData = it.data || {};
        var itName = (itData.name || itData.display || it.name || '').trim().toLowerCase();
        var itTime = parseFloat(itData.time !== undefined ? itData.time : it.meta && it.meta.time) || 0;
        
        // Exact name match and time within 0.5s or time within 0.1s
        if (itName && lmName && itName === lmName && Math.abs(itTime - lmTime) < 0.5) {
          return true;
        }
        if (Math.abs(itTime - lmTime) < 0.05) {
          return true;
        }
        return false;
      });

      if (inBin) return true;

      // Check permanently deleted landmarks
      var permLm = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_LANDMARKS), []);
      var inPerm = permLm.some(function (p) {
        if (p.videoId && p.videoId !== videoId) return false;
        var pName = (p.name || '').trim().toLowerCase();
        var pTime = parseFloat(p.time) || 0;
        if (pName && lmName && pName === lmName && Math.abs(pTime - lmTime) < 0.5) return true;
        if (Math.abs(pTime - lmTime) < 0.05) return true;
        return false;
      });

      return inPerm;
    },

    /**
     * Add any deleted item to the Recycle Bin and synchronously remove it from active storage
     * @param {Object} params { type: 'survey'|'user'|'video'|'landmark', id, name, subtitle, data, meta }
     */
    addItem: function (params) {
      if (!params || !params.type || !params.id) {
        console.error('Invalid bin item:', params);
        return null;
      }

      var items = this.getBinItems();
      var binId = 'bin_' + params.type + '_' + params.id + '_' + Date.now();

      // Check if already in bin
      var existingIdx = items.findIndex(function (it) {
        return it.id === params.id && it.type === params.type;
      });

      var record = {
        binId: binId,
        type: params.type,
        id: params.id,
        name: params.name || 'Untitled ' + params.type,
        subtitle: params.subtitle || '',
        deletedAt: new Date().toISOString(),
        data: params.data || {},
        meta: params.meta || {}
      };

      if (existingIdx > -1) {
        items[existingIdx] = record;
      } else {
        items.unshift(record);
      }
      this.saveBinItems(items);

      // Clear any prior restoration record for this item
      try {
        var restored = safeJsonParse(localStorage.getItem('tp_restored_items'), []);
        restored = restored.filter(function (r) { return !(String(r.id) === String(params.id) && r.type === params.type); });
        localStorage.setItem('tp_restored_items', JSON.stringify(restored));
      } catch (e) {}

      // --- Atomically purge item from active datasets and record in deletion keys ---
      var id = params.id;
      var type = params.type;

      if (type === 'survey') {
        var isCustom = id.startsWith('custom-') || (params.meta && params.meta.isCustom);
        
        // Ensure added to deleted_surveys
        var delSurveys = safeJsonParse(localStorage.getItem(STORAGE_DELETED_SURVEYS), []);
        if (!delSurveys.includes(id)) {
          delSurveys.push(id);
          localStorage.setItem(STORAGE_DELETED_SURVEYS, JSON.stringify(delSurveys));
        }

        // Remove from custom_surveys
        var customSurveys = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_SURVEYS), []);
        customSurveys = customSurveys.filter(function (s) { return s.id !== id; });
        localStorage.setItem(STORAGE_CUSTOM_SURVEYS, JSON.stringify(customSurveys));

        // Remove from edited_surveys
        var editedSurveys = safeJsonParse(localStorage.getItem(STORAGE_EDITED_SURVEYS), []);
        editedSurveys = editedSurveys.filter(function (e) { return e.id !== id; });
        localStorage.setItem(STORAGE_EDITED_SURVEYS, JSON.stringify(editedSurveys));

        if (isCustom && params.data) {
          var delCustom = safeJsonParse(localStorage.getItem(STORAGE_DELETED_CUSTOM_SURVEYS), []);
          if (!delCustom.some(function (s) { return s.id === id; })) {
            delCustom.push(params.data);
            localStorage.setItem(STORAGE_DELETED_CUSTOM_SURVEYS, JSON.stringify(delCustom));
          }
        }
      } else if (type === 'user') {
        var isCustomUser = id.startsWith('user-') || (params.meta && params.meta.isCustom);

        var delUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_USERS), []);
        if (!delUsers.includes(id)) {
          delUsers.push(id);
          localStorage.setItem(STORAGE_DELETED_USERS, JSON.stringify(delUsers));
        }

        var customUsers = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_USERS), []);
        customUsers = customUsers.filter(function (u) { return u.uid !== id; });
        localStorage.setItem(STORAGE_CUSTOM_USERS, JSON.stringify(customUsers));

        var editedUsers = safeJsonParse(localStorage.getItem(STORAGE_EDITED_USERS), []);
        editedUsers = editedUsers.filter(function (u) { return u.uid !== id; });
        localStorage.setItem(STORAGE_EDITED_USERS, JSON.stringify(editedUsers));

        if (isCustomUser && params.data) {
          var delCustomUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_CUSTOM_USERS), []);
          if (!delCustomUsers.some(function (u) { return u.uid === id; })) {
            delCustomUsers.push(params.data);
            localStorage.setItem(STORAGE_DELETED_CUSTOM_USERS, JSON.stringify(delCustomUsers));
          }
        }
      } else if (type === 'video') {
        var delVideos = safeJsonParse(localStorage.getItem(STORAGE_DELETED_VIDEOS), []);
        if (!delVideos.includes(id)) {
          delVideos.push(id);
          localStorage.setItem(STORAGE_DELETED_VIDEOS, JSON.stringify(delVideos));
        }

        var customVideos = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_VIDEOS), []);
        customVideos = customVideos.filter(function (v) { return v.id !== id; });
        localStorage.setItem(STORAGE_CUSTOM_VIDEOS, JSON.stringify(customVideos));

        var editedVideos = safeJsonParse(localStorage.getItem(STORAGE_EDITED_VIDEOS), []);
        editedVideos = editedVideos.filter(function (v) { return v.id !== id; });
        localStorage.setItem(STORAGE_EDITED_VIDEOS, JSON.stringify(editedVideos));
      } else if (type === 'landmark') {
        var videoId = (params.meta && params.meta.videoId) || (params.data && params.data.videoId);
        if (videoId) {
          var lmKey = 'landmarks_' + videoId;
          var landmarks = safeJsonParse(localStorage.getItem(lmKey), []);
          var targetLm = params.data || {};
          var targetName = (targetLm.name || targetLm.display || params.name || '').trim().toLowerCase();
          var targetTime = parseFloat(targetLm.time !== undefined ? targetLm.time : params.meta && params.meta.time) || 0;

          landmarks = landmarks.filter(function (l) {
            var lName = (l.name || l.display || '').trim().toLowerCase();
            var lTime = parseFloat(l.time) || 0;
            if (lName && targetName && lName === targetName && Math.abs(lTime - targetTime) < 0.5) return false;
            if (Math.abs(lTime - targetTime) < 0.05) return false;
            return true;
          });
          localStorage.setItem(lmKey, JSON.stringify(landmarks));
        }
      }

      return record;
    },

    /**
     * Restore an item from the Recycle Bin by its binId
     */
    restoreItem: function (binId) {
      var items = this.getBinItems();
      var targetIdx = items.findIndex(function (it) {
        return it.binId === binId;
      });

      if (targetIdx === -1) {
        console.warn('Item not found in bin:', binId);
        return null;
      }

      var item = items[targetIdx];
      var type = item.type;
      var id = item.id;
      var data = item.data || {};
      var meta = item.meta || {};

      try {
        if (type === 'survey') {
          var isCustom = id.startsWith('custom-') || meta.isCustom;
          
          // Remove from deleted_surveys & perm_deleted_surveys
          var delSurveys = safeJsonParse(localStorage.getItem(STORAGE_DELETED_SURVEYS), []);
          delSurveys = delSurveys.filter(function (val) { return val !== id; });
          localStorage.setItem(STORAGE_DELETED_SURVEYS, JSON.stringify(delSurveys));

          var permSurveys = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_SURVEYS), []);
          permSurveys = permSurveys.filter(function (val) { return val !== id; });
          localStorage.setItem(STORAGE_PERM_DELETED_SURVEYS, JSON.stringify(permSurveys));

          var delCustom = safeJsonParse(localStorage.getItem(STORAGE_DELETED_CUSTOM_SURVEYS), []);
          delCustom = delCustom.filter(function (s) { return s.id !== id; });
          localStorage.setItem(STORAGE_DELETED_CUSTOM_SURVEYS, JSON.stringify(delCustom));

          if (isCustom) {
            var customSurveys = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_SURVEYS), []);
            if (!customSurveys.some(function (s) { return s.id === id; })) {
              customSurveys.push(data);
              localStorage.setItem(STORAGE_CUSTOM_SURVEYS, JSON.stringify(customSurveys));
            }
          }

          if (meta.isEdited && data) {
            var editedSurveys = safeJsonParse(localStorage.getItem(STORAGE_EDITED_SURVEYS), []);
            var edIdx = editedSurveys.findIndex(function (e) { return e.id === id; });
            if (edIdx > -1) editedSurveys[edIdx] = data;
            else editedSurveys.push(data);
            localStorage.setItem(STORAGE_EDITED_SURVEYS, JSON.stringify(editedSurveys));
          }
        } else if (type === 'user') {
          // Restore user
          var deletedUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_USERS), []);
          deletedUsers = deletedUsers.filter(function (val) { return val !== id; });
          localStorage.setItem(STORAGE_DELETED_USERS, JSON.stringify(deletedUsers));

          var permUsers = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_USERS), []);
          permUsers = permUsers.filter(function (val) { return val !== id; });
          localStorage.setItem(STORAGE_PERM_DELETED_USERS, JSON.stringify(permUsers));

          var isCustomUser = id.startsWith('user-') || meta.isCustom;
          if (isCustomUser) {
            var delCustomUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_CUSTOM_USERS), []);
            delCustomUsers = delCustomUsers.filter(function (u) { return (u.uid || u.id) !== id; });
            localStorage.setItem(STORAGE_DELETED_CUSTOM_USERS, JSON.stringify(delCustomUsers));

            var customUsers = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_USERS), []);
            if (!customUsers.some(function (u) { return u.uid === id; })) {
              customUsers.push(data);
              localStorage.setItem(STORAGE_CUSTOM_USERS, JSON.stringify(customUsers));
            }
          }
          if (meta.isEdited && data) {
            var editedUsers = safeJsonParse(localStorage.getItem(STORAGE_EDITED_USERS), []);
            var eIdx = editedUsers.findIndex(function (e) { return e.uid === id; });
            if (eIdx > -1) editedUsers[eIdx] = data;
            else editedUsers.push(data);
            localStorage.setItem(STORAGE_EDITED_USERS, JSON.stringify(editedUsers));
          }
        } else if (type === 'video') {
          // Restore video
          var deletedVideos = safeJsonParse(localStorage.getItem(STORAGE_DELETED_VIDEOS), []);
          deletedVideos = deletedVideos.filter(function (val) { return val !== id; });
          localStorage.setItem(STORAGE_DELETED_VIDEOS, JSON.stringify(deletedVideos));

          var permVideos = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_VIDEOS), []);
          permVideos = permVideos.filter(function (val) { return val !== id; });
          localStorage.setItem(STORAGE_PERM_DELETED_VIDEOS, JSON.stringify(permVideos));

          var isCustomVid = id.startsWith('vid-') || meta.isCustom;
          if (isCustomVid) {
            var customVideos = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_VIDEOS), []);
            if (!customVideos.some(function (v) { return v.id === id; })) {
              customVideos.push(data);
              localStorage.setItem(STORAGE_CUSTOM_VIDEOS, JSON.stringify(customVideos));
            }
          }
          if (meta.isEdited && data) {
            var editedVideos = safeJsonParse(localStorage.getItem(STORAGE_EDITED_VIDEOS), []);
            var vIdx = editedVideos.findIndex(function (e) { return e.id === id; });
            if (vIdx > -1) editedVideos[vIdx] = data;
            else editedVideos.push(data);
            localStorage.setItem(STORAGE_EDITED_VIDEOS, JSON.stringify(editedVideos));
          }
        } else if (type === 'landmark') {
          // Restore landmark
          var videoId = meta.videoId || data.videoId;
          if (videoId) {
            var lmKey = 'landmarks_' + videoId;
            var landmarks = safeJsonParse(localStorage.getItem(lmKey), []);
            var restoredLm = Object.assign({}, data);
            
            // Check if already in landmarks array
            var alreadyExists = landmarks.some(function (l) {
              return (l.name === restoredLm.name) && Math.abs(parseFloat(l.time) - parseFloat(restoredLm.time)) < 0.1;
            });
            if (!alreadyExists) {
              landmarks.push(restoredLm);
              landmarks.sort(function (a, b) { return (parseFloat(a.time) || 0) - (parseFloat(b.time) || 0); });
              localStorage.setItem(lmKey, JSON.stringify(landmarks));
            }

            // Remove from perm deleted landmarks
            var permLm = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_LANDMARKS), []);
            permLm = permLm.filter(function (p) {
              return !(p.videoId === videoId && p.name === restoredLm.name && Math.abs((p.time || 0) - (restoredLm.time || 0)) < 0.1);
            });
            localStorage.setItem(STORAGE_PERM_DELETED_LANDMARKS, JSON.stringify(permLm));
          }
        }

        // Remove from bin
        items.splice(targetIdx, 1);
        this.saveBinItems(items);

        // Record restoration timestamp so cloud sync propagates the undelete
        try {
          var restoredList = safeJsonParse(localStorage.getItem('tp_restored_items'), []);
          var rIdx = restoredList.findIndex(function (r) { return String(r.id) === String(id) && r.type === type; });
          var rRecord = { id: String(id), type: type, restoredAt: new Date().toISOString() };
          if (rIdx > -1) restoredList[rIdx] = rRecord;
          else restoredList.push(rRecord);
          localStorage.setItem('tp_restored_items', JSON.stringify(restoredList));
        } catch (e) {}

        this.showToast('"' + item.name + '" (' + this.getTypeDisplayName(type) + ') restored successfully.', 'success');
        window.dispatchEvent(new CustomEvent('tp_item_restored', { detail: item }));
        window.dispatchEvent(new CustomEvent('tp_data_changed', { detail: { key: 'tp_recycle_bin', action: 'restore', item: item } }));
        return item;
      } catch (err) {
        console.error('Error during item restoration:', err);
        this.showToast('Failed to restore item: ' + err.message, 'warning');
        return null;
      }
    },

    /**
     * Restore all items (optionally filtered by type)
     */
    restoreAll: function (filterType) {
      var items = this.getBinItems();
      var toRestore = items.filter(function (it) {
        return !filterType || filterType === 'all' || it.type === filterType;
      });

      if (toRestore.length === 0) return 0;

      var restoredCount = 0;
      var self = this;
      toRestore.forEach(function (it) {
        var res = self.restoreItem(it.binId);
        if (res) restoredCount++;
      });

      this.showToast('Successfully restored ' + restoredCount + ' item(s).', 'success');
      return restoredCount;
    },

    /**
     * Permanently delete a single item from the bin so it never shows in bin AND never shows on platform
     */
    permanentlyDelete: function (binId) {
      var items = this.getBinItems();
      var idx = items.findIndex(function (it) { return it.binId === binId; });
      if (idx === -1) return false;

      var item = items[idx];
      var id = item.id;

      if (item.type === 'survey') {
        var permSurveys = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_SURVEYS), []);
        if (!permSurveys.includes(id)) {
          permSurveys.push(id);
          localStorage.setItem(STORAGE_PERM_DELETED_SURVEYS, JSON.stringify(permSurveys));
        }

        // Keep in deleted_surveys so active tables never load it
        var delSurveys = safeJsonParse(localStorage.getItem(STORAGE_DELETED_SURVEYS), []);
        if (!delSurveys.includes(id)) {
          delSurveys.push(id);
          localStorage.setItem(STORAGE_DELETED_SURVEYS, JSON.stringify(delSurveys));
        }

        var delCustom = safeJsonParse(localStorage.getItem(STORAGE_DELETED_CUSTOM_SURVEYS), []);
        delCustom = delCustom.filter(function (s) { return s.id !== id; });
        localStorage.setItem(STORAGE_DELETED_CUSTOM_SURVEYS, JSON.stringify(delCustom));

        var customSurveys = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_SURVEYS), []);
        customSurveys = customSurveys.filter(function (s) { return s.id !== id; });
        localStorage.setItem(STORAGE_CUSTOM_SURVEYS, JSON.stringify(customSurveys));
      } else if (item.type === 'user') {
        var permUsers = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_USERS), []);
        if (!permUsers.includes(id)) {
          permUsers.push(id);
          localStorage.setItem(STORAGE_PERM_DELETED_USERS, JSON.stringify(permUsers));
        }

        var delUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_USERS), []);
        if (!delUsers.includes(id)) {
          delUsers.push(id);
          localStorage.setItem(STORAGE_DELETED_USERS, JSON.stringify(delUsers));
        }

        var delCustomUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_CUSTOM_USERS), []);
        delCustomUsers = delCustomUsers.filter(function (u) { return (u.uid || u.id) !== id; });
        localStorage.setItem(STORAGE_DELETED_CUSTOM_USERS, JSON.stringify(delCustomUsers));

        var customUsers = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_USERS), []);
        customUsers = customUsers.filter(function (u) { return u.uid !== id; });
        localStorage.setItem(STORAGE_CUSTOM_USERS, JSON.stringify(customUsers));
      } else if (item.type === 'video') {
        var permVideos = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_VIDEOS), []);
        if (!permVideos.includes(id)) {
          permVideos.push(id);
          localStorage.setItem(STORAGE_PERM_DELETED_VIDEOS, JSON.stringify(permVideos));
        }

        var delVideos = safeJsonParse(localStorage.getItem(STORAGE_DELETED_VIDEOS), []);
        if (!delVideos.includes(id)) {
          delVideos.push(id);
          localStorage.setItem(STORAGE_DELETED_VIDEOS, JSON.stringify(delVideos));
        }

        var customVideos = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_VIDEOS), []);
        customVideos = customVideos.filter(function (v) { return v.id !== id; });
        localStorage.setItem(STORAGE_CUSTOM_VIDEOS, JSON.stringify(customVideos));
      } else if (item.type === 'landmark') {
        var permLm = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_LANDMARKS), []);
        var lmObj = item.data || {};
        permLm.push({
          videoId: (item.meta && item.meta.videoId) || lmObj.videoId,
          name: lmObj.name || lmObj.display || item.name,
          time: lmObj.time !== undefined ? lmObj.time : (item.meta && item.meta.time)
        });
        localStorage.setItem(STORAGE_PERM_DELETED_LANDMARKS, JSON.stringify(permLm));
      }

      items.splice(idx, 1);
      this.saveBinItems(items);

      // Clean from tp_restored_items if present
      try {
        var restoredPerm = safeJsonParse(localStorage.getItem('tp_restored_items'), []);
        restoredPerm = restoredPerm.filter(function (r) { return !(String(r.id) === String(id) && r.type === item.type); });
        localStorage.setItem('tp_restored_items', JSON.stringify(restoredPerm));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('tp_data_changed', { detail: { key: 'permanently_deleted_' + item.type, action: 'permanent_delete', item: item } }));
      this.showToast('Item permanently deleted.', 'info');
      return true;
    },

    /**
     * Empty entire recycle bin
     */
    emptyBin: function () {
      var items = this.getBinItems();
      var self = this;
      while (items.length > 0) {
        self.permanentlyDelete(items[0].binId);
        items = self.getBinItems();
      }
      this.saveBinItems([]);
      this.showToast('Recycle Bin emptied.', 'info');
    },

    getTypeDisplayName: function (type) {
      switch (type) {
        case 'survey': return 'Survey';
        case 'user': return 'User';
        case 'video': return 'Video';
        case 'landmark': return 'Landmark';
        default: return type || 'Item';
      }
    },

    getTypeBadgeClass: function (type) {
      switch (type) {
        case 'survey': return 'bin-badge-survey';
        case 'user': return 'bin-badge-user';
        case 'video': return 'bin-badge-video';
        case 'landmark': return 'bin-badge-landmark';
        default: return 'bin-badge-survey';
      }
    },

    getTypeIconSvg: function (type) {
      switch (type) {
        case 'survey':
          return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>';
        case 'user':
          return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
        case 'video':
          return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>';
        case 'landmark':
          return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
        default:
          return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';
      }
    },

    /**
     * Complete Bidirectional Synchronization:
     * 1. Guarantees that EVERY item in tp_recycle_bin is purged from active stores and added to deleted keys.
     * 2. Imports any legacy deletions into tp_recycle_bin (unless permanently deleted).
     */
    syncAll: function () {
      var items = this.getBinItems();
      var hasChanges = false;

      // Ensure every item currently in tp_recycle_bin is absent from active stores
      var delSurveys = safeJsonParse(localStorage.getItem(STORAGE_DELETED_SURVEYS), []);
      var customSurveys = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_SURVEYS), []);
      var delUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_USERS), []);
      var customUsers = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_USERS), []);
      var delVideos = safeJsonParse(localStorage.getItem(STORAGE_DELETED_VIDEOS), []);
      var customVideos = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_VIDEOS), []);

      items.forEach(function (it) {
        if (it.type === 'survey') {
          if (!delSurveys.includes(it.id)) delSurveys.push(it.id);
          customSurveys = customSurveys.filter(function (s) { return s.id !== it.id; });
        } else if (it.type === 'user') {
          if (!delUsers.includes(it.id)) delUsers.push(it.id);
          customUsers = customUsers.filter(function (u) { return u.uid !== it.id; });
        } else if (it.type === 'video') {
          if (!delVideos.includes(it.id)) delVideos.push(it.id);
          customVideos = customVideos.filter(function (v) { return v.id !== it.id; });
        } else if (it.type === 'landmark') {
          var vidId = (it.meta && it.meta.videoId) || (it.data && it.data.videoId);
          if (vidId) {
            var lmKey = 'landmarks_' + vidId;
            var lms = safeJsonParse(localStorage.getItem(lmKey), []);
            var lmData = it.data || {};
            var lmName = (lmData.name || lmData.display || it.name || '').trim().toLowerCase();
            var lmTime = parseFloat(lmData.time !== undefined ? lmData.time : (it.meta && it.meta.time)) || 0;
            var initialLen = lms.length;
            lms = lms.filter(function (l) {
              var lName = (l.name || l.display || '').trim().toLowerCase();
              var lTime = parseFloat(l.time) || 0;
              if (lName && lmName && lName === lmName && Math.abs(lTime - lmTime) < 0.5) return false;
              if (Math.abs(lTime - lmTime) < 0.05) return false;
              return true;
            });
            if (lms.length !== initialLen) {
              localStorage.setItem(lmKey, JSON.stringify(lms));
            }
          }
        }
      });

      localStorage.setItem(STORAGE_DELETED_SURVEYS, JSON.stringify(delSurveys));
      localStorage.setItem(STORAGE_CUSTOM_SURVEYS, JSON.stringify(customSurveys));
      localStorage.setItem(STORAGE_DELETED_USERS, JSON.stringify(delUsers));
      localStorage.setItem(STORAGE_CUSTOM_USERS, JSON.stringify(customUsers));
      localStorage.setItem(STORAGE_DELETED_VIDEOS, JSON.stringify(delVideos));
      localStorage.setItem(STORAGE_CUSTOM_VIDEOS, JSON.stringify(customVideos));

      // Import legacy deleted custom surveys if not in bin
      var deletedCustomSurveys = safeJsonParse(localStorage.getItem(STORAGE_DELETED_CUSTOM_SURVEYS), []);
      deletedCustomSurveys.forEach(function (s) {
        if (!items.some(function (it) { return it.id === s.id && it.type === 'survey'; })) {
          items.push({
            binId: 'bin_survey_' + s.id + '_' + Date.now(),
            type: 'survey',
            id: s.id,
            name: s.name || 'Custom Survey',
            subtitle: (s.department || 'N/A') + ' • ' + (s.survey_length || 'N/A'),
            deletedAt: new Date().toISOString(),
            data: s,
            meta: { isCustom: true }
          });
          hasChanges = true;
        }
      });

      // Base surveys are never phantom-imported

      // Import legacy deleted custom users if not in bin
      var deletedCustomUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_CUSTOM_USERS), []);
      deletedCustomUsers.forEach(function (u) {
        var uUid = u.uid || u.id;
        if (!uUid) return;
        if (!items.some(function (it) { return it.id === uUid && it.type === 'user'; })) {
          items.push({
            binId: 'bin_user_' + uUid + '_' + Date.now(),
            type: 'user',
            id: uUid,
            name: u.name || ('User ' + uUid.substring(0, 8)),
            subtitle: (u.email || 'No email') + ' • ' + (u.organization || u.department || 'User Account'),
            deletedAt: new Date().toISOString(),
            data: u,
            meta: { isCustom: true }
          });
          hasChanges = true;
        }
      });

      // Base users are never phantom-imported

      // Base videos are never phantom-imported

      if (hasChanges) {
        this.saveBinItems(items);
      }
    },

    /**
     * Render the Recycle Bin Modal content into the modal container
     */
    renderModal: function (options) {
      options = options || {};
      var modal = document.getElementById(options.modalId || 'recycleBinModal');
      if (!modal) return;

      var items = this.getBinItems();
      var counts = {
        all: items.length,
        survey: items.filter(function (it) { return it.type === 'survey'; }).length,
        user: items.filter(function (it) { return it.type === 'user'; }).length,
        video: items.filter(function (it) { return it.type === 'video'; }).length,
        landmark: items.filter(function (it) { return it.type === 'landmark'; }).length
      };

      var activeFilter = this.activeFilter || 'all';
      var filteredItems = items.filter(function (it) {
        if (activeFilter === 'all') return true;
        return it.type === activeFilter;
      });

      // Render Filter Bar
      var filterBar = modal.querySelector('.bin-filter-bar');
      if (!filterBar) {
        var body = modal.querySelector('.modal-body');
        if (body) {
          filterBar = document.createElement('div');
          filterBar.className = 'bin-filter-bar';
          var desc = body.querySelector('p');
          if (desc) {
            desc.after(filterBar);
          } else {
            body.prepend(filterBar);
          }
        }
      }

      if (filterBar) {
        var binSelf = this;
        var filterConfigs = [
          { key: 'all', label: 'All Items' },
          { key: 'survey', label: 'Surveys' },
          { key: 'user', label: 'Users' },
          { key: 'video', label: 'Videos' },
          { key: 'landmark', label: 'Landmarks' }
        ];

        filterBar.innerHTML = '';
        filterConfigs.forEach(function (fc) {
          var pill = document.createElement('button');
          pill.type = 'button';
          pill.className = 'bin-filter-pill' + (activeFilter === fc.key ? ' active' : '');
          pill.innerHTML = escapeHtml(fc.label) + ' <span class="bin-filter-count">' + (counts[fc.key] || 0) + '</span>';
          pill.onclick = function () {
            binSelf.activeFilter = fc.key;
            binSelf.renderModal(options);
          };
          filterBar.appendChild(pill);
        });
      }

      var tbody = modal.querySelector('#recycleBinTableBody');
      var emptyMsg = modal.querySelector('#recycleBinEmptyMsg');
      var tableContainer = modal.querySelector('.table-container');

      if (!tbody) return;
      tbody.innerHTML = '';

      if (filteredItems.length === 0) {
        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyMsg) {
          emptyMsg.style.display = 'block';
          emptyMsg.innerHTML = '<div class="bin-empty-state">' +
            '<div class="bin-empty-icon">' +
              '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
            '</div>' +
            '<div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">No deleted items</div>' +
            '<div style="font-size: 0.8125rem;">The Recycle Bin is currently empty' + (activeFilter !== 'all' ? ' for ' + binSelf.getTypeDisplayName(activeFilter) + 's.' : '.') + '</div>' +
          '</div>';
        }
        return;
      }

      if (tableContainer) tableContainer.style.display = 'block';
      if (emptyMsg) emptyMsg.style.display = 'none';

      var binSelf = this;
      filteredItems.forEach(function (item) {
        var tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--surface-border)';

        var badgeClass = binSelf.getTypeBadgeClass(item.type);
        var badgeLabel = binSelf.getTypeDisplayName(item.type);
        var badgeIcon = binSelf.getTypeIconSvg(item.type);

        tr.innerHTML =
          '<td style="padding: 0.75rem 0.5rem; vertical-align: middle;">' +
            '<span class="bin-badge ' + badgeClass + '">' + badgeIcon + ' ' + badgeLabel + '</span>' +
          '</td>' +
          '<td style="padding: 0.75rem; vertical-align: middle;">' +
            '<div style="font-weight: 600; color: var(--text-primary); font-size: 0.875rem; margin-bottom: 0.2rem;">' + escapeHtml(item.name) + '</div>' +
            '<div style="font-size: 0.75rem; color: var(--text-secondary);">' + escapeHtml(item.subtitle || '—') + '</div>' +
          '</td>' +
          '<td style="padding: 0.75rem; color: var(--text-secondary); font-size: 0.75rem; vertical-align: middle; white-space: nowrap;">' +
            formatDate(item.deletedAt) +
          '</td>' +
          '<td style="padding: 0.75rem; text-align: right; vertical-align: middle; white-space: nowrap;">' +
            '<button type="button" class="btn-recycle-restore" data-bin-id="' + item.binId + '" title="Restore item">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>' +
              ' Restore' +
            '</button>' +
            '<button type="button" class="btn-recycle-perm" data-bin-id="' + item.binId + '" style="margin-left: 0.4rem;" title="Delete permanently">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
              ' Delete' +
            '</button>' +
          '</td>';

        // Bind button actions
        var restoreBtn = tr.querySelector('.btn-recycle-restore');
        restoreBtn.onclick = function () {
          binSelf.restoreItem(item.binId);
          binSelf.renderModal(options);
          if (typeof options.onUpdate === 'function') options.onUpdate();
        };

        var permBtn = tr.querySelector('.btn-recycle-perm');
        permBtn.onclick = function () {
          if (confirm('Are you sure you want to permanently delete "' + item.name + '"? This action cannot be undone.')) {
            binSelf.permanentlyDelete(item.binId);
            binSelf.renderModal(options);
            if (typeof options.onUpdate === 'function') options.onUpdate();
          }
        };

        tbody.appendChild(tr);
      });
    },

    /**
     * Show a modern floating toast notification
     */
    showToast: function (msg, type) {
      type = type || 'success';
      var container = document.getElementById('tpToastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'tpToastContainer';
        container.className = 'tp-toast-container';
        document.body.appendChild(container);
      }

      var toast = document.createElement('div');
      toast.className = 'tp-toast ' + type;

      var iconSvg = type === 'success'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

      toast.innerHTML = iconSvg + '<span>' + escapeHtml(msg) + '</span>';
      container.appendChild(toast);

      setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(function () {
          if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
      }, 3500);
    }
  };

  // Run full bidirectional synchronization on initialization
  try {
    TrueProgressBin.syncAll();
  } catch (e) {
    console.error('Error during recycle bin syncAll:', e);
  }

  window.TrueProgressBin = TrueProgressBin;

})(window);
