/**
 * Tracker-side callback: a State change on a SPEC *TASK* card is POSTed to the
 * local sync listener (scripts/spec-graph-sync.mjs --serve) as a hint. The
 * listener re-reads the issue from the YouTrack API and only applies the
 * task-only spec_patch when the tracker-held SpecId matches, SpecKind is TASK,
 * and the real State maps to a governed spec status — a forged event cannot
 * inject a status the tracker does not actually hold.
 *
 * Listener: http://host.docker.internal:8787/writeback — cleartext over the
 * host-local Docker bridge, an acknowledged boundary (NFR-SECURITY-1): the
 * token gates event acceptance only, the listener re-verifies every event
 * against the tracker before any spec write, so a captured token buys event
 * flooding, not status injection. Non-host-local deployments MUST put the
 * listener behind TLS and update LISTENER_URL accordingly.
 * Payload: { specId, toState, issueId } — never tokens or secrets.
 * The listener requires SPEC_WRITEBACK_TOKEN on every bind (loopback is
 * reachable from containers via host.docker.internal); paste the value from
 * ~/.omp/spec-writeback-token into LISTENER_TOKEN below, or events get 401
 * and the periodic sweep remains the convergence path.
 */
const entities = require('@jetbrains/youtrack-scripting-api/entities');
const http = require('@jetbrains/youtrack-scripting-api/http');

const LISTENER_URL = 'http://host.docker.internal:8787/writeback';
const LISTENER_TOKEN = '';

function specField(issue, name) {
  try {
    const fields = issue.fields;
    const value = fields ? fields[name] : null;
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return value.name || value.presentation || '';
  } catch (error) {
    return '';
  }
}

exports.rule = entities.Issue.onChange({
  title: 'spec-writeback',
  guard: (ctx) => {
    const issue = ctx.issue;
    if (issue.project.key !== 'SPEC' || !issue.isChanged('State')) return false;
    // Only TASK cards carry a governed status; the sync-state marker and
    // FR/AC/NFR/SCENARIO cards can never produce a valid writeback.
    return specField(issue, 'SpecKind') === 'TASK' && specField(issue, 'SpecId') !== '';
  },
  action: (ctx) => {
    const issue = ctx.issue;
    const payload = {
      specId: specField(issue, 'SpecId'),
      toState: issue.fields.State ? issue.fields.State.name : '',
      issueId: issue.id
    };
    if (!payload.specId || !payload.toState) return;
    try {
      const connection = new http.Connection(LISTENER_URL);
      connection.addHeader('Content-Type', 'application/json');
      if (LISTENER_TOKEN) connection.addHeader('X-Spec-Writeback-Token', LISTENER_TOKEN);
      connection.postSync('', JSON.stringify(payload));
    } catch (error) {
      console.warn('spec-writeback: listener unreachable, tracker State stays authoritative until the next sweep: ' + error.message);
    }
  },
  requirements: {}
});
