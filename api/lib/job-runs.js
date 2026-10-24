// Run log for scheduled and CLI jobs (job_runs), read by the admin data health page.
// trackRun(job, fn) records start, finish, result or error around fn. Logging never
// blocks the job: if the log write fails the job still runs.
import { query } from './db.js';

let tableReady;
export function ensureJobRunsTable() {
  if (!tableReady) {
    tableReady = query(`
      CREATE TABLE IF NOT EXISTS job_runs (
        id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        job         text NOT NULL,
        started_at  timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz,
        ok          boolean,
        result      jsonb,
        error       text
      );
      CREATE INDEX IF NOT EXISTS job_runs_job_idx ON job_runs (job, started_at DESC);
    `).catch((err) => { tableReady = undefined; throw err; });
  }
  return tableReady;
}

/** Run fn() and log it under `job`. Returns fn's result; rethrows its error. */
export async function trackRun(job, fn) {
  let id = null;
  try {
    await ensureJobRunsTable();
    id = (await query('INSERT INTO job_runs (job) VALUES ($1) RETURNING id', [job]))[0]?.id ?? null;
  } catch (err) {
    console.warn(`[job-runs] could not log start of ${job}:`, err.message);
  }
  const finish = (ok, result, error) => id != null && query(
    'UPDATE job_runs SET finished_at = now(), ok = $2, result = $3, error = $4 WHERE id = $1',
    [id, ok, result == null ? null : JSON.stringify(result), error ? String(error).slice(0, 1000) : null],
  ).catch((err) => console.warn(`[job-runs] could not log end of ${job}:`, err.message));
  try {
    const result = await fn();
    await finish(true, result, null);
    return result;
  } catch (err) {
    await finish(false, null, err.message);
    throw err;
  }
}

export async function pruneJobRuns(days = 90) {
  await ensureJobRunsTable();
  await query(`DELETE FROM job_runs WHERE started_at < now() - $1::int * interval '1 day'`, [days]);
}
