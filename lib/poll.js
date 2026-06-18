// Poll a RankGoat async job (plan-add, plan-generate) until it leaves the
// "running" state or the timeout elapses. The server reports terminal states as
// "done" / "error"; anything else is treated as still in flight.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitForJob(client, kind, target, { intervalMs = 2000, timeoutMs = 240_000, onTick } = {}) {
  const start = Date.now();
  for (;;) {
    const job = await client.get(`/jobs/${encodeURIComponent(kind)}/${encodeURIComponent(target)}`);
    if (job.status !== "running") return job;
    if (Date.now() - start > timeoutMs) return job;
    if (onTick) onTick(job);
    await sleep(intervalMs);
  }
}
