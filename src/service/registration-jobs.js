/**
 * In-process runner for self-service registrations.
 *
 * A registration clones the repository into the service, which takes minutes
 * for a large repository. The MCP call therefore answers as soon as the work is
 * queued, and this runner performs it while writing each phase into the
 * registration row, so `spec_repo {"action":"status"}` can report progress.
 *
 * The store row is the durable marker (`status: pending` plus a phase); this
 * map is only the "is it running right now" fence, so a repeated call cannot
 * start a second clone of the same repository.
 */
export function createRegistrationJobs({ repos, store, logger = () => {} }) {
  const running = new Map();

  function isRunning(project) {
    return running.has(project);
  }

  /** Queue the work; returns false when this project already has a job. */
  function start(input) {
    const project = input.projectId;
    if (running.has(project)) return false;
    const job = (async () => {
      try {
        await repos.registerRun(input);
      } catch (error) {
        // The row already carries the failure; the log keeps the trace for the
        // operator without turning a background job into an unhandled rejection.
        logger(`registration ${project} failed: ${String(error?.message ?? error).split("\n")[0]}`);
      }
    })();
    running.set(project, job);
    void job.finally(() => {
      if (running.get(project) === job) running.delete(project);
    });
    return true;
  }

  /**
   * Restart every registration that was queued before a restart. A queued row
   * whose sealed credential cannot be recovered is marked as an error instead
   * of being left pending with nothing running.
   */
  function resume() {
    const rows = store?.listRegistrations?.() ?? [];
    let started = 0;
    for (const row of rows) {
      if (row.status !== "pending") continue;
      const input = repos.registrationInput(row);
      if (input === null) {
        repos.failRegistration(row.project, "the sealed credential could not be recovered; register the project again");
        continue;
      }
      if (start(input)) started += 1;
    }
    if (started > 0) logger(`registration resume: ${started} queued registration(s) restarted`);
    return started;
  }

  /** The running job for a project, for callers that need to wait on it. */
  function whenSettled(project) {
    return running.get(project) ?? Promise.resolve();
  }

  return { start, resume, isRunning, whenSettled, runningCount: () => running.size };
}
