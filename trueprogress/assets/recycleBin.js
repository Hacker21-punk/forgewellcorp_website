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
  var STORAGE_EDITED_USERS = 'edited_users';

  var STORAGE_CUSTOM_VIDEOS = 'custom_videos';
  var STORAGE_DELETED_VIDEOS = 'deleted_videos';
  var STORAGE_EDITED_VIDEOS = 'edited_videos';

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
      // Sort descending by deletedAt
      items.sort(function (a, b) {
        var tA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
        var tB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
        return tB - tA;
      });
      return items;
    },

    saveBinItems: function (items) {
      localStorage.setItem(STORAGE_BIN, JSON.stringify(items || []));
      window.dispatchEvent(new CustomEvent('tp_bin_updated', { detail: { items: items } }));
    },

    /**
     * Add any deleted item to the Recycle Bin
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
          if (isCustom) {
            var customSurveys = safeJsonParse(localStorage.getItem(STORAGE_CUSTOM_SURVEYS), []);
            if (!customSurveys.some(function (s) { return s.id === id; })) {
              customSurveys.push(data);
              localStorage.setItem(STORAGE_CUSTOM_SURVEYS, JSON.stringify(customSurveys));
            }
            var delCustom = safeJsonParse(localStorage.getItem(STORAGE_DELETED_CUSTOM_SURVEYS), []);
            delCustom = delCustom.filter(function (s) { return s.id !== id; });
            localStorage.setItem(STORAGE_DELETED_CUSTOM_SURVEYS, JSON.stringify(delCustom));
          } else {
            var delSurveys = safeJsonParse(localStorage.getItem(STORAGE_DELETED_SURVEYS), []);
            delSurveys = delSurveys.filter(function (val) { return val !== id; });
            localStorage.setItem(STORAGE_DELETED_SURVEYS, JSON.stringify(delSurveys));

            var permSurveys = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_SURVEYS), []);
            permSurveys = permSurveys.filter(function (val) { return val !== id; });
            localStorage.setItem(STORAGE_PERM_DELETED_SURVEYS, JSON.stringify(permSurveys));

            if (meta.isEdited && data) {
              var editedSurveys = safeJsonParse(localStorage.getItem(STORAGE_EDITED_SURVEYS), []);
              var edIdx = editedSurveys.findIndex(function (e) { return e.id === id; });
              if (edIdx > -1) editedSurveys[edIdx] = data;
              else editedSurveys.push(data);
              localStorage.setItem(STORAGE_EDITED_SURVEYS, JSON.stringify(editedSurveys));
            }
          }
        } else if (type === 'user') {
          // Restore user
          var deletedUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_USERS), []);
          deletedUsers = deletedUsers.filter(function (val) { return val !== id; });
          localStorage.setItem(STORAGE_DELETED_USERS, JSON.stringify(deletedUsers));

          var isCustomUser = id.startsWith('user-') || meta.isCustom;
          if (isCustomUser) {
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
            landmarks.push(data);
            landmarks.sort(function (a, b) { return (a.time || 0) - (b.time || 0); });
            localStorage.setItem(lmKey, JSON.stringify(landmarks));
          }
        }

        // Remove from bin
        items.splice(targetIdx, 1);
        this.saveBinItems(items);

        this.showToast('"' + item.name + '" (' + this.getTypeDisplayName(type) + ') restored successfully.', 'success');
        window.dispatchEvent(new CustomEvent('tp_item_restored', { detail: item }));
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
     * Permanently delete a single item from the bin
     */
    permanentlyDelete: function (binId) {
      var items = this.getBinItems();
      var idx = items.findIndex(function (it) { return it.binId === binId; });
      if (idx === -1) return false;

      var item = items[idx];

      // If it's a default survey, record in permanently_deleted_surveys
      if (item.type === 'survey' && !item.id.startsWith('custom-')) {
        var permSurveys = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_SURVEYS), []);
        if (!permSurveys.includes(item.id)) {
          permSurveys.push(item.id);
          localStorage.setItem(STORAGE_PERM_DELETED_SURVEYS, JSON.stringify(permSurveys));
        }
      }

      // If it's a custom survey, also remove from deleted_custom_surveys
      if (item.type === 'survey' && item.id.startsWith('custom-')) {
        var delCustom = safeJsonParse(localStorage.getItem(STORAGE_DELETED_CUSTOM_SURVEYS), []);
        delCustom = delCustom.filter(function (s) { return s.id !== item.id; });
        localStorage.setItem(STORAGE_DELETED_CUSTOM_SURVEYS, JSON.stringify(delCustom));
      }

      items.splice(idx, 1);
      this.saveBinItems(items);
      this.showToast('Item permanently deleted.', 'info');
      return true;
    },

    /**
     * Empty entire recycle bin
     */
    emptyBin: function () {
      var items = this.getBinItems();
      var permSurveys = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_SURVEYS), []);

      items.forEach(function (it) {
        if (it.type === 'survey' && !it.id.startsWith('custom-')) {
          if (!permSurveys.includes(it.id)) {
            permSurveys.push(it.id);
          }
        }
      });

      localStorage.setItem(STORAGE_PERM_DELETED_SURVEYS, JSON.stringify(permSurveys));
      localStorage.setItem(STORAGE_DELETED_CUSTOM_SURVEYS, JSON.stringify([]));
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
     * Synchronize legacy deletions from older sessions so that nothing is missed.
     */
    syncLegacyDeletions: function () {
      var items = this.getBinItems();
      var hasChanges = false;

      // 1. Sync legacy deleted_custom_surveys
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

      // 2. Sync legacy deleted default surveys
      var deletedSurveys = safeJsonParse(localStorage.getItem(STORAGE_DELETED_SURVEYS), []);
      var permanentlyDeleted = safeJsonParse(localStorage.getItem(STORAGE_PERM_DELETED_SURVEYS), []);
      deletedSurveys.forEach(function (id) {
        if (permanentlyDeleted.includes(id)) return;
        if (!items.some(function (it) { return it.id === id && it.type === 'survey'; })) {
          items.push({
            binId: 'bin_survey_' + id + '_' + Date.now(),
            type: 'survey',
            id: id,
            name: 'Survey #' + id,
            subtitle: 'Default Survey Archive',
            deletedAt: new Date().toISOString(),
            data: { id: id },
            meta: { isCustom: false }
          });
          hasChanges = true;
        }
      });

      // 3. Sync legacy deleted users
      var deletedUsers = safeJsonParse(localStorage.getItem(STORAGE_DELETED_USERS), []);
      deletedUsers.forEach(function (uid) {
        if (!items.some(function (it) { return it.id === uid && it.type === 'user'; })) {
          items.push({
            binId: 'bin_user_' + uid + '_' + Date.now(),
            type: 'user',
            id: uid,
            name: 'User ' + uid.substring(0, 8),
            subtitle: 'Deleted User Account',
            deletedAt: new Date().toISOString(),
            data: { uid: uid },
            meta: { isCustom: uid.startsWith('user-') }
          });
          hasChanges = true;
        }
      });

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
        var filters = [
          { key: 'all', label: 'All Items' },
          { key: 'survey', label: 'Surveys' },
          { key: 'user', label: 'Users' },
          { key: 'video', label: 'Videos' },
          { key: 'landmark', label: 'Landmarks' }
        ];

        var self = this;
        filterBar.innerHTML = '';
        filters.forEach(function (f) {
          var count = counts[f.key] || 0;
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'bin-filter-pill' + (activeFilter === f.key ? ' active' : '');
          btn.innerHTML = escapeHtml(f.label) + ' <span class="bin-filter-count">' + count + '</span>';
          btn.onclick = function () {
            self.activeFilter = f.key;
            self.renderModal(options);
          };
          filterBar.appendChild(btn);
        });
      }

      // Update table header if needed
      var tableThead = modal.querySelector('table thead');
      if (tableThead) {
        tableThead.innerHTML = '<tr>' +
          '<th style="text-align: left; width: 110px;">Type</th>' +
          '<th style="text-align: left;">Item &amp; Details</th>' +
          '<th style="text-align: left; width: 160px;">Deleted Date</th>' +
          '<th style="text-align: right; width: 190px;">Action</th>' +
          '</tr>';
      }

      // Populate table body
      var tbody = modal.querySelector('#recycleBinTableBody');
      var emptyMsg = modal.querySelector('#recycleBinEmptyMsg');
      var emptyBtn = modal.querySelector('#emptyRecycleBinBtn');
      var restoreAllBtn = modal.querySelector('#restoreAllBinBtn');

      if (!tbody) return;
      tbody.innerHTML = '';

      if (filteredItems.length === 0) {
        tbody.parentElement.style.display = 'none';
        if (emptyMsg) {
          emptyMsg.style.display = 'block';
          emptyMsg.innerHTML = '<div class="bin-empty-state">' +
            '<div class="bin-empty-icon">' +
              '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
            '</div>' +
            '<h4 style="margin: 0 0 0.5rem; color: var(--text-primary); font-size: 1rem;">No Deleted Items</h4>' +
            '<p style="margin: 0; font-size: 0.85rem; color: var(--text-tertiary);">' +
              (activeFilter === 'all' ? 'Your Recycle Bin is currently empty.' : 'No deleted ' + activeFilter + 's found.') +
            '</p>' +
          '</div>';
        }
        if (emptyBtn) {
          emptyBtn.disabled = true;
          emptyBtn.style.opacity = '0.5';
          emptyBtn.style.cursor = 'not-allowed';
        }
        if (restoreAllBtn) {
          restoreAllBtn.disabled = true;
          restoreAllBtn.style.opacity = '0.5';
          restoreAllBtn.style.cursor = 'not-allowed';
        }
        return;
      }

      tbody.parentElement.style.display = 'table';
      if (emptyMsg) emptyMsg.style.display = 'none';

      if (emptyBtn) {
        emptyBtn.disabled = false;
        emptyBtn.style.opacity = '1';
        emptyBtn.style.cursor = 'pointer';
      }
      if (restoreAllBtn) {
        restoreAllBtn.disabled = false;
        restoreAllBtn.style.opacity = '1';
        restoreAllBtn.style.cursor = 'pointer';
      }

      var binSelf = this;
      filteredItems.forEach(function (item) {
        var tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--surface-border)';

        var badgeClass = binSelf.getTypeBadgeClass(item.type);
        var badgeIcon = binSelf.getTypeIconSvg(item.type);
        var badgeLabel = binSelf.getTypeDisplayName(item.type);

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

  // Run initial legacy sync
  try {
    TrueProgressBin.syncLegacyDeletions();
  } catch (e) {
    console.error('Error during legacy recycle bin sync:', e);
  }

  window.TrueProgressBin = TrueProgressBin;

})(window);
