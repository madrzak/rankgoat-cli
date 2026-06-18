// rankgoat jobs <kind> <target> [--wait] - poll an async job (e.g. plan-generate,
// plan-add). With --wait, block until it finishes.
import { printJson, kv, status, c } from "../output.js";
import { waitForJob } from "../poll.js";

export default async function run(args, ctx) {
  const client = ctx.getClient();
  const [kind, target] = args;
  if (!kind || !target) {
    console.error("Usage: rankgoat jobs <kind> <target> [--wait]");
    process.exitCode = 1;
    return;
  }

  const job = ctx.flags.wait
    ? await waitForJob(client, kind, target)
    : await client.get(`/jobs/${encodeURIComponent(kind)}/${encodeURIComponent(target)}`);

  if (ctx.json) return printJson(job);
  kv([
    ["Kind", job.kind],
    ["Target", job.target],
    ["Status", status(job.status)],
    ["Error", job.error || c.gray("-")],
    ["Result", job.result ? JSON.stringify(job.result) : c.gray("-")],
  ]);
  if (job.status === "error") process.exitCode = 1;
}
