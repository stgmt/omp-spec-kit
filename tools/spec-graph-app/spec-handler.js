/**
 * Auth-path HTTP handler (TASK-12): the verified bridge between a YouTrack
 * session and spec-registryd. The widget calls this endpoint via
 * `host.fetchApp()`; YouTrack authenticates the caller as the session user,
 * so `ctx.currentUser` cannot be forged by the browser. The handler forwards
 * the MCP request to the service with:
 *   - the app bridge token (secret app setting) — authenticates this app;
 *   - X-Spec-User: ctx.currentUser.login — the user the service must
 *     re-verify against the YouTrack API before authorizing.
 * The full interactive spec UI (view + proposals) is TASK-8; this handler is
 * the auth/data path it builds on.
 */
const http = require('@jetbrains/youtrack-scripting-api/http');

exports.httpHandler = {
  endpoints: [
    {
      scope: 'global',
      method: 'POST',
      path: 'spec',
      handle: function (ctx) {
        const settings = ctx.settings || {};
        const serviceUrl = settings.serviceUrl;
        const bridgeToken = settings.serviceBridgeToken;
        let body;
        try {
          body = ctx.request.json();
        } catch (error) {
          ctx.response.json({ error: 'request body must be JSON' });
          return;
        }
        // The setup page must render before settings exist, so this one method
        // reports configuration presence without touching the service and
        // without echoing either secret.
        if (body && body.method === 'health/app') {
          // The marker project is a short name, never user input; keep the
          // response shape strict so the widget can build the issue query.
          const configuredMarker = typeof settings.markerProject === 'string' ? settings.markerProject.trim() : '';
          const markerProject = /^[A-Za-z][A-Za-z0-9_]*$/u.test(configuredMarker) ? configuredMarker : 'SPEC';
          ctx.response.json({
            ok: Boolean(serviceUrl && bridgeToken),
            serviceUrlConfigured: Boolean(serviceUrl),
            bridgeTokenConfigured: Boolean(bridgeToken),
            markerProject,
            missing: [
              serviceUrl ? null : 'serviceUrl',
              bridgeToken ? null : 'serviceBridgeToken'
            ].filter(Boolean)
          });
          return;
        }
        if (!serviceUrl || !bridgeToken) {
          ctx.response.json({ error: 'app settings are not configured: serviceUrl and serviceBridgeToken are required' });
          return;
        }
        const currentUser = ctx.currentUser;
        const login = currentUser && currentUser.login;
        if (!login) {
          ctx.response.json({ error: 'no authenticated user in handler context' });
          return;
        }
        const payload = {
          jsonrpc: '2.0',
          id: body && body.id !== undefined ? body.id : 'app-bridge',
          method: body && typeof body.method === 'string' ? body.method : 'tools/call',
          params: body && body.params ? body.params : {}
        };
        const connection = new http.Connection(serviceUrl);
        connection.addHeader('Content-Type', 'application/json');
        connection.addHeader('Accept', 'application/json, text/event-stream');
        // Secret settings are only substituted inside http.js: bearerAuth
        // injects the real value (addHeader('Authorization', 'Bearer ' + …)
        // would send the <***> mask).
        connection.bearerAuth(bridgeToken);
        connection.addHeader('X-Spec-User', login);
        // Identity and repository binding are MCP tools now (spec_identity,
        // spec_repo): the app methods translate into tool calls and unwrap the
        // tool's data, so the service keeps one surface per capability.
        var method = payload.method;
        var restPath = null;
        var restMethod = 'POST';
        var toolCall = null;
        var repoActions = {
          'repo/bindings': 'bindings',
          'repo/probe': 'probe',
          'repo/bind': 'bind',
          'repo/unbind': 'unbind'
        };
        if (method === 'service/me') { restPath = '/me'; restMethod = 'GET'; }
        else if (Object.prototype.hasOwnProperty.call(repoActions, method)) {
          toolCall = { name: 'spec_repo', args: Object.assign({ action: repoActions[method] }, payload.params || {}) };
        } else if (method === 'idp/bindings') { restPath = '/idp/bindings'; restMethod = 'GET'; }
        else if (method === 'idp/probe') { restPath = '/idp/probe'; }
        else if (method === 'idp/bind') { restPath = '/idp/bind'; }
        else if (method === 'idp/unbind') { restPath = '/idp/unbind'; }
        else if (method === 'onboarding/token') { restPath = '/onboarding/token'; }
        var response;
        if (toolCall) {
          var rpcPayload = {
            jsonrpc: '2.0',
            id: payload.id,
            method: 'tools/call',
            params: { name: toolCall.name, arguments: toolCall.args }
          };
          response = connection.postSync('/mcp', null, JSON.stringify(rpcPayload));
          if (response && response.code >= 200 && response.code < 300) {
            var unwrapped = unwrapToolData(response.body);
            if (unwrapped) {
              ctx.response.json(unwrapped);
              return;
            }
          }
        } else if (restPath) {
          var restBody = restMethod === 'POST' ? JSON.stringify(payload.params || {}) : null;
          response = restMethod === 'GET'
            ? connection.getSync(restPath)
            : connection.postSync(restPath, null, restBody);
        } else {
          response = connection.postSync('/mcp', null, JSON.stringify(payload));
        }
        if (!response || response.code < 200 || response.code >= 300) {
          ctx.response.json({
            error: 'service request failed',
            status: response ? response.code : 0,
            body: response ? String(response.body).slice(0, 500) : ''
          });
          return;
        }
        try {
          ctx.response.json(JSON.parse(response.body));
        } catch (error) {
          ctx.response.json({ error: 'service returned a non-JSON response' });
        }
      }
    }
  ]
};
