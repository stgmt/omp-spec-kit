/**
 * Spec Stack dashboard and committed-snapshot health, shared by the Spec
 * Service page and its behavior tests.
 *
 * `host` is the YouTrack widget host: anything with
 * `fetchYouTrack(url, init?) -> Promise<json>`. Keeping the network contracts
 * here (instead of inline in index.html) lets the release gate exercise the
 * idempotent provisioning and sharing rules without a browser.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SpecAppDashboard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DASHBOARD_NAME = 'Spec Stack';
  var APP_NAME = 'spec-graph-app';
  var BOARD_KEY = 'spec-board';
  var FULL_WIDTH = 12;
  var BOARD_HEIGHT = 8;
  var SNAPSHOT_PREFIX = 'SPEC-SYNC-STATE\n';
  var DEFAULT_MARKER_PROJECT = 'SPEC';

  function arrayOf(value) {
    return Array.isArray(value) ? value : [];
  }

  function findDashboard(rows, name) {
    var list = arrayOf(rows);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].name === (name || DASHBOARD_NAME)) return list[i];
    }
    return null;
  }

  function findBoardWidget(apps, appName) {
    var list = arrayOf(apps);
    for (var i = 0; i < list.length; i += 1) {
      if (!list[i] || list[i].name !== (appName || APP_NAME)) continue;
      var widgets = arrayOf(list[i].widgets);
      for (var w = 0; w < widgets.length; w += 1) {
        if (widgets[w] && widgets[w].key === BOARD_KEY) return widgets[w];
      }
    }
    return null;
  }

  /**
   * One healthy dashboard has exactly one `spec-board` embedding, it points at
   * the currently installed app widget, and it spans the full grid. A board
   * with an old embedding id, a narrow width, or duplicates is stale even
   * though its key matches.
   */
  function inspectDashboard(dashboard, widgetId) {
    if (!dashboard) return { state: 'missing' };
    var boards = arrayOf(dashboard.widgets).filter(function (entry) {
      return entry && entry.key === BOARD_KEY;
    });
    if (boards.length === 0) return { state: 'missing-widget' };
    if (boards.length > 1) return { state: 'duplicate', count: boards.length };
    var board = boards[0];
    var embedded = board.widget && board.widget.id ? board.widget.id : null;
    if (widgetId && embedded !== widgetId) return { state: 'stale', widgetId: embedded };
    if (Number(board.width) !== FULL_WIDTH) return { state: 'wrong-width', width: board.width };
    return { state: 'ok', widgetId: embedded, width: Number(board.width) };
  }

  function inspectDetail(verdict) {
    if (verdict.state === 'missing-widget') return 'Spec Stack exists without spec-board';
    if (verdict.state === 'stale') return 'Spec Stack spec-board points at an outdated app widget';
    if (verdict.state === 'wrong-width') return 'spec-board is not full width (w:' + verdict.width + ')';
    if (verdict.state === 'duplicate') return 'Spec Stack has ' + verdict.count + ' spec-board widgets';
    return 'Spec Stack dashboard is not provisioned';
  }

  function findAllUsers(groups) {
    var list = arrayOf(groups);
    for (var i = 0; i < list.length; i += 1) {
      if (!list[i]) continue;
      if (list[i].name === 'All Users' || list[i].$type === 'AllUsersGroup') return list[i];
    }
    return null;
  }

  function mergeGroups(existing, extra) {
    var byId = {};
    var list = arrayOf(existing);
    var add = arrayOf(extra);
    for (var i = 0; i < list.length; i += 1) if (list[i] && list[i].id) byId[list[i].id] = list[i];
    for (var e = 0; e < add.length; e += 1) if (add[e] && add[e].id) byId[add[e].id] = add[e];
    var out = [];
    for (var key in byId) {
      if (!Object.prototype.hasOwnProperty.call(byId, key)) continue;
      out.push({
        id: byId[key].id,
        name: byId[key].name,
        ringId: byId[key].ringId,
        icon: byId[key].icon || null
      });
    }
    return out;
  }

  function errorText(error) {
    var text = error && error.message ? error.message : error;
    return String(text == null ? '' : text).slice(0, 300);
  }

  function isDuplicateKeyError(error) {
    var text = errorText(error) + ' ' + String((error && error.status) || '');
    return /duplicate|already (?:exists|present)|should be unique|unique within|409/iu.test(text);
  }

  function dashboardUrl(dashboardId) {
    return '/dashboard?id=' + encodeURIComponent(dashboardId);
  }

  function checkDashboard(host) {
    var found = null;
    return host.fetchYouTrack('dashboards?fields=id,name&$top=200').then(function (rows) {
      found = findDashboard(rows);
      if (!found) return null;
      return Promise.all([
        host.fetchYouTrack('dashboards/' + encodeURIComponent(found.id) +
          '?fields=id,name,widgets(id,key,x,y,width,height,widget(id)),' +
          'readSharingSettings(permittedGroups(id,name,ringId))'),
        host.fetchYouTrack('admin/apps?fields=id,name,widgets(id,key)&$top=500'),
        host.fetchYouTrack('groups?fields=id,name,ringId,$type&$top=500')
      ]);
    }).then(function (results) {
      if (!found) {
        return { status: 'warn', detail: 'Spec Stack is not provisioned', action: 'provision' };
      }
      var dashboard = results[0];
      var widget = findBoardWidget(results[1]);
      if (!widget) {
        return {
          status: 'warn',
          detail: 'spec-board is not registered on ' + APP_NAME,
          dashboardId: found.id,
          action: 'install',
        };
      }
      var verdict = inspectDashboard(dashboard, widget.id);
      if (verdict.state !== 'ok') {
        return {
          status: 'warn',
          detail: inspectDetail(verdict),
          dashboardId: found.id,
          action: 'provision',
        };
      }
      var allUsers = findAllUsers(results[2]) ||
        findAllUsers(dashboard.readSharingSettings && dashboard.readSharingSettings.permittedGroups);
      var shared = false;
      var permitted = arrayOf(dashboard.readSharingSettings && dashboard.readSharingSettings.permittedGroups);
      if (allUsers) {
        for (var p = 0; p < permitted.length; p += 1) {
          if (permitted[p] && permitted[p].id === allUsers.id) shared = true;
        }
      }
      if (!shared) {
        return {
          status: 'warn',
          detail: 'Spec Stack is not shared with All Users',
          dashboardId: found.id,
          action: 'provision',
        };
      }
      return {
        status: 'ok',
        detail: 'Spec Stack has one full-width spec-board widget shared with All Users',
        dashboardId: found.id,
        url: dashboardUrl(found.id),
      };
    }).catch(function (error) {
      return { status: 'info', detail: 'dashboard check unavailable: ' + errorText(error) };
    });
  }

  function dashboardBody(dash, readGroups) {
    return {
      id: dash.id,
      name: dash.name,
      pinned: dash.pinned,
      isDefault: dash.isDefault,
      canEdit: dash.canEdit,
      canTransfer: dash.canTransfer,
      canShare: dash.canShare,
      owner: { id: dash.owner && dash.owner.id },
      widgets: arrayOf(dash.widgets).map(function (widget) {
        return {
          id: widget.id,
          key: widget.key,
          x: widget.x,
          y: widget.y,
          width: widget.width,
          height: widget.height,
          widget: widget.widget,
          settings: widget.settings,
        };
      }),
      readSharingSettings: {
        permittedGroups: readGroups,
        permittedUsers: arrayOf(dash.readSharingSettings && dash.readSharingSettings.permittedUsers)
          .map(function (user) { return { id: user.id }; }),
      },
      updateSharingSettings: {
        permittedGroups: arrayOf(dash.updateSharingSettings && dash.updateSharingSettings.permittedGroups)
          .map(function (group) {
            return { id: group.id, name: group.name, ringId: group.ringId, icon: group.icon || null };
          }),
        permittedUsers: arrayOf(dash.updateSharingSettings && dash.updateSharingSettings.permittedUsers)
          .map(function (user) { return { id: user.id }; }),
      },
    };
  }

  /**
   * Share with the requested groups. A missing group is a hard failure: the
   * page must never report a provisioned dashboard while it is unshared.
   */
  function shareDashboard(host, dashboardId, options) {
    var groups = arrayOf(options && options.groups);
    var names = groups.length ? groups : ['All Users'];
    var fields = 'id,name,pinned,isDefault,canEdit,canTransfer,canShare,owner(id),' +
      'widgets(id,key,x,y,width,height,widget(id),settings),' +
      'readSharingSettings(permittedGroups(id,name,ringId),permittedUsers(id)),' +
      'updateSharingSettings(permittedGroups(id,name,ringId),permittedUsers(id))';
    return Promise.all([
      host.fetchYouTrack('dashboards/' + encodeURIComponent(dashboardId) + '?fields=' + fields),
      host.fetchYouTrack('groups?fields=id,name,ringId,$type&$top=500')
    ]).then(function (results) {
      var dash = results[0];
      var available = arrayOf(results[1]);
      var existing = arrayOf(dash.readSharingSettings && dash.readSharingSettings.permittedGroups);
      var wanted = [];
      for (var i = 0; i < names.length; i += 1) {
        var group = null;
        for (var a = 0; a < available.length; a += 1) {
          if (available[a] && (available[a].name === names[i] ||
              (names[i] === 'All Users' && available[a].$type === 'AllUsersGroup'))) {
            group = available[a];
            break;
          }
        }
        if (!group && names[i] === 'All Users') group = findAllUsers(existing);
        if (!group) throw new Error('share group not found: ' + names[i]);
        var already = false;
        for (var e = 0; e < existing.length; e += 1) if (existing[e].id === group.id) already = true;
        if (!already) wanted.push(group);
      }
      if (wanted.length === 0) {
        return { shared: true, added: false, groups: names };
      }
      return host.fetchYouTrack('dashboards/' + encodeURIComponent(dashboardId), {
        method: 'POST',
        body: dashboardBody(dash, mergeGroups(existing, wanted)),
      }).then(function () {
        return { shared: true, added: true, groups: names };
      });
    });
  }

  function removeBoardWidgets(host, dashboardId, widgets) {
    var base = 'dashboards/' + encodeURIComponent(dashboardId) + '/widgets/';
    return Promise.all(arrayOf(widgets).map(function (widget) {
      return host.fetchYouTrack(base + encodeURIComponent(widget.id), { method: 'DELETE' });
    }));
  }

  function ensureBoard(host, dashboardId, widgetId) {
    var base = 'dashboards/' + encodeURIComponent(dashboardId) + '/widgets';
    var body = { key: BOARD_KEY, widget: { id: widgetId }, x: 0, y: 0, width: FULL_WIDTH, height: BOARD_HEIGHT };
    return host.fetchYouTrack(
      'dashboards/' + encodeURIComponent(dashboardId) +
      '?fields=id,name,widgets(id,key,x,y,width,height,widget(id))'
    ).then(function (dashboard) {
      var existing = arrayOf(dashboard && dashboard.widgets).filter(function (entry) {
        return entry && entry.key === BOARD_KEY;
      });
      var verdict = inspectDashboard({ widgets: existing }, widgetId);
      if (verdict.state === 'ok') return { changed: false, replaced: 0, atomic: true };
      var create = function () {
        return host.fetchYouTrack(base, { method: 'POST', body: body });
      };
      if (existing.length === 0) {
        return create().then(function () {
          return { changed: true, replaced: 0, atomic: true };
        });
      }
      // Prefer create-then-delete so a failed replacement leaves the old board
      // intact. Only a duplicate-key refusal justifies the destructive retry;
      // a network or validation error must propagate.
      return create().then(function () {
        return removeBoardWidgets(host, dashboardId, existing).then(function () {
          return { changed: true, replaced: existing.length, atomic: true };
        });
      }, function (error) {
        if (!isDuplicateKeyError(error)) throw error;
        return removeBoardWidgets(host, dashboardId, existing).then(create).then(function () {
          return { changed: true, replaced: existing.length, atomic: false };
        });
      });
    });
  }

  function provisionDashboard(host, options) {
    var log = (options && options.log) || function () {};
    var widgetId = null;
    log('start');
    return host.fetchYouTrack('admin/apps?fields=id,name,widgets(id,key)&$top=500').then(function (apps) {
      log('apps');
      var widget = findBoardWidget(apps);
      if (!widget) throw new Error('spec-board is not registered on ' + APP_NAME);
      widgetId = widget.id;
      return host.fetchYouTrack('dashboards?fields=id,name&$top=200');
    }).then(function (rows) {
      log('dashboards');
      var dashboard = findDashboard(rows);
      if (dashboard) return dashboard;
      return host.fetchYouTrack('dashboards?fields=id,name', {
        method: 'POST',
        body: { name: DASHBOARD_NAME },
      });
    }).then(function (dashboard) {
      log('widgets');
      return ensureBoard(host, dashboard.id, widgetId).then(function (board) {
        log('share');
        return shareDashboard(host, dashboard.id).then(function (share) {
          // Verify the persisted state instead of trusting the write calls: a
          // second user must see the same full-width, shared dashboard.
          return checkDashboard(host).then(function (health) {
            if (health.status !== 'ok') {
              throw new Error('dashboard verification failed: ' + health.detail);
            }
            return {
              ok: true,
              dashboardId: dashboard.id,
              url: health.url,
              board: board,
              share: share,
              health: health,
            };
          });
        });
      });
    });
  }

  function checkSnapshot(host, options) {
    var project = (options && options.project) ||
      (options && options.markerProject) || DEFAULT_MARKER_PROJECT;
    var query = 'project: ' + project + ' and summary: {SPEC:SYNC-STATE}';
    return host.fetchYouTrack(
      'issues?query=' + encodeURIComponent(query) +
      '&fields=id,description,customFields(name,value(name,text))&$top=50'
    ).then(function (rows) {
      var list = arrayOf(rows);
      var pointer = null;
      for (var i = 0; i < list.length; i += 1) {
        if (specIdFromIssue(list[i]) !== 'SPEC:SYNC-STATE') continue;
        if (!pointer || String(list[i].id).localeCompare(String(pointer.id), undefined, { numeric: true }) < 0) {
          pointer = list[i];
        }
      }
      if (!pointer) return { status: 'warn', detail: 'no committed snapshot yet' };
      var description = pointer.description || '';
      if (description.indexOf(SNAPSHOT_PREFIX) !== 0) return { status: 'error', detail: 'snapshot marker is invalid' };
      var marker;
      try {
        marker = JSON.parse(description.slice(SNAPSHOT_PREFIX.length));
      } catch (error) {
        return { status: 'error', detail: 'snapshot marker is not valid JSON' };
      }
      var snapshot = marker && marker.snapshot;
      if (marker.schemaVersion !== 'BoardSnapshotV1' || marker.complete !== true || !snapshot ||
          snapshot.schemaVersion !== 'BoardSnapshotV1' || snapshot.complete !== true ||
          snapshot.page !== null || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) {
        return { status: 'error', detail: 'snapshot is incomplete' };
      }
      return { status: 'ok', detail: snapshot.nodes.length + ' nodes, ' + snapshot.edges.length + ' edges' };
    }).catch(function (error) {
      return { status: 'info', detail: 'snapshot check unavailable: ' + errorText(error) };
    });
  }

  function specIdFromIssue(issue) {
    var fields = arrayOf(issue && issue.customFields);
    for (var i = 0; i < fields.length; i += 1) {
      if (!fields[i] || fields[i].name !== 'SpecId') continue;
      var value = fields[i].value;
      if (typeof value === 'string') return value;
      return (value && (value.text || value.name)) || '';
    }
    return '';
  }

  return {
    DASHBOARD_NAME: DASHBOARD_NAME,
    APP_NAME: APP_NAME,
    BOARD_KEY: BOARD_KEY,
    FULL_WIDTH: FULL_WIDTH,
    DEFAULT_MARKER_PROJECT: DEFAULT_MARKER_PROJECT,
    findDashboard: findDashboard,
    findBoardWidget: findBoardWidget,
    inspectDashboard: inspectDashboard,
    findAllUsers: findAllUsers,
    mergeGroups: mergeGroups,
    isDuplicateKeyError: isDuplicateKeyError,
    checkDashboard: checkDashboard,
    shareDashboard: shareDashboard,
    provisionDashboard: provisionDashboard,
    checkSnapshot: checkSnapshot,
  };
});
