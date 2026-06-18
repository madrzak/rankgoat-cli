// rankgoat plan — the monthly content plan (briefs the AI will turn into posts).
//   plan list <siteId> [--month YYYY-MM]
//   plan add <siteId> --auto [--month] | --title <t> [--keyword --meta --type --intent --angle --date]
//   plan edit <itemId> [--title --keyword --meta --type --intent --angle --date]
//   plan schedule <itemId> <YYYY-MM-DD>
//   plan archive <itemId>
//   plan restore <itemId>
//   plan generate <itemId> [--wait]
import { printJson, table, kv, status, dash, success, note, c } from "../output.js";
import { waitForJob } from "../poll.js";
import { requireId } from "./sites.js";

// Map --flag names to the API's brief field names. Used by add (manual) + edit.
function briefFromFlags(flags) {
  const body = {};
  if (flags.title != null) body.title = flags.title;
  if (flags.keyword != null) body.targetKeyword = flags.keyword;
  if (flags.meta != null) body.metaDescription = flags.meta;
  if (flags.type != null) body.type = flags.type;
  if (flags.intent != null) body.intent = flags.intent;
  if (flags.angle != null) body.productAngle = flags.angle;
  if (flags.date != null) body.scheduledFor = flags.date;
  return body;
}

function printItem(it) {
  kv([
    ["ID", it.id],
    ["Site", it.siteId],
    ["Month", it.month],
    ["Status", status(it.status)],
    ["Type", dash(it.type)],
    ["Title", c.bold(it.title)],
    ["Keyword", dash(it.targetKeyword)],
    ["Intent", dash(it.intent)],
    ["Meta", dash(it.metaDescription)],
    ["Scheduled", dash(it.scheduledFor)],
    ["Post ID", dash(it.postId)],
  ]);
}

export default async function run(args, ctx) {
  const client = ctx.getClient();
  const sub = args[0];

  if (sub === "list") {
    const id = requireId(args[1], "plan list <siteId> [--month YYYY-MM]");
    if (id == null) return;
    const data = await client.get(`/sites/${id}/plan`, { query: { month: ctx.flags.month } });
    if (ctx.json) return printJson(data);
    note(`Plan for site ${data.siteId} — ${data.month}`);
    if (!data.items.length) return console.log("No briefs planned.");
    table(
      ["ID", "POS", "STATUS", "TYPE", "DATE", "TITLE"],
      data.items.map((it) => [it.id, it.position, status(it.status), dash(it.type), dash(it.scheduledFor), it.title]),
    );
    return;
  }

  if (sub === "add") {
    const id = requireId(args[1], "plan add <siteId> (--auto | --title ...)");
    if (id == null) return;
    if (ctx.flags.auto) {
      const { job } = await client.post(`/sites/${id}/plan`, { body: { mode: "auto", month: ctx.flags.month } });
      return finishJob(client, ctx, job, "AI is planning a brief");
    }
    const body = briefFromFlags(ctx.flags);
    if (!body.title) {
      console.error("A manual brief needs --title (or pass --auto to let AI plan one).");
      process.exitCode = 1;
      return;
    }
    if (ctx.flags.month) body.month = ctx.flags.month;
    const item = await client.post(`/sites/${id}/plan`, { body });
    if (ctx.json) return printJson(item);
    success(`Added brief #${item.id}: ${item.title}`);
    return;
  }

  if (sub === "edit") {
    const id = requireId(args[1], "plan edit <itemId> [--title ...]");
    if (id == null) return;
    const body = briefFromFlags(ctx.flags);
    if (!Object.keys(body).length) {
      console.error("Nothing to change. Pass at least one of --title --keyword --meta --type --intent --angle --date.");
      process.exitCode = 1;
      return;
    }
    const item = await client.patch(`/plan/${id}`, { body });
    if (ctx.json) return printJson(item);
    success(`Updated brief #${item.id}`);
    printItem(item);
    return;
  }

  if (sub === "schedule") {
    const id = requireId(args[1], "plan schedule <itemId> <YYYY-MM-DD>");
    if (id == null) return;
    const date = args[2] || ctx.flags.date;
    if (!date) {
      console.error("Usage: rankgoat plan schedule <itemId> <YYYY-MM-DD>");
      process.exitCode = 1;
      return;
    }
    const item = await client.post(`/plan/${id}/schedule`, { body: { date } });
    if (ctx.json) return printJson(item);
    success(`Brief #${item.id} scheduled for ${item.scheduledFor}`);
    return;
  }

  if (sub === "archive" || sub === "restore") {
    const id = requireId(args[1], `plan ${sub} <itemId>`);
    if (id == null) return;
    const item = await client.post(`/plan/${id}/${sub}`, {});
    if (ctx.json) return printJson(item);
    success(`Brief #${item.id} ${sub === "archive" ? "archived" : "restored"} (now ${item.status})`);
    return;
  }

  if (sub === "generate") {
    const id = requireId(args[1], "plan generate <itemId> [--wait]");
    if (id == null) return;
    const { job } = await client.post(`/plan/${id}/generate`, {});
    return finishJob(client, ctx, job, "Writing the post");
  }

  console.error(`Unknown plan command: ${sub}. Try: list, add, edit, schedule, archive, restore, generate.`);
  process.exitCode = 1;
}

// Shared handling for the two async (202 + job) endpoints. With --wait we poll
// to completion; otherwise we print the job handle so the caller can poll later.
async function finishJob(client, ctx, job, label) {
  if (!ctx.flags.wait) {
    if (ctx.json) return printJson({ job });
    note(`${label} in the background. Poll with: rankgoat jobs ${job.kind} ${job.target} --wait`);
    return;
  }
  if (!ctx.json) process.stderr.write(`${label}… `);
  const done = await waitForJob(client, job.kind, job.target);
  if (ctx.json) return printJson(done);
  if (done.status === "done") success(`done. ${done.result ? JSON.stringify(done.result) : ""}`);
  else {
    console.log(`${c.red("✗")} ${done.status}: ${done.error || "see dashboard"}`);
    process.exitCode = 1;
  }
}
