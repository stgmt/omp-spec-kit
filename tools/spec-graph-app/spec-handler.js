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
        let body;
        try {
          body = ctx.request.json();
        } catch (error) {
          ctx.response.json({ error: 'request body must be JSON' });
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
        const response = connection.postSync('/mcp', null, JSON.stringify(payload));
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
