// rankgoat hubs - content hubs (topic clusters). The monthly planner draws
// briefs from active hubs, weighted by priority.
//   hubs list <siteId>
//   hubs add <siteId> --name <n> [--description <d>] [--keywords "a, b"] [--priority high|medium|low]
//   hubs edit <hubId> [--name --description --keywords --priority]
//   hubs archive <hubId>
//   hubs restore <hubId>
import { printJson, table, kv, success, dash, c } from "../output.js";
import { requireId } from "./sites.js";

function hubBodyFromFlags(flags) {
  const body = {};
  if (flags.name != null) body.name = flags.name;
  if (flags.description != null) body.description = flags.description;
  if (flags.keywords != null) body.keywords = flags.keywords;
  if (flags.priority != null) body.priority = flags.priority;
  return body;
}

function printHub(h) {
  kv([
    ["ID", h.id],
    ["Site", h.site_id],
    ["Name", c.bold(h.name)],
    ["Description", dash(h.description)],
    ["Keywords", h.keywords && h.keywords.length ? h.keywords.join(", ") : "-"],
    ["Priority", dash(h.priority)],
    ["Status", dash(h.status)],
  ]);
}

export default async function run(args, ctx) {
  const client = ctx.getClient();
  const sub = args[0];

  if (sub === "list") {
    const id = requireId(args[1], "hubs list <siteId>");
    if (id == null) return;
    const data = await client.get(`/sites/${id}/hubs`);
    if (ctx.json) return printJson(data);
    if (!data.hubs.length) return console.log("No hubs yet.");
    table(
      ["ID", "STATUS", "PRIORITY", "NAME", "KEYWORDS"],
      data.hubs.map((h) => [h.id, dash(h.status), dash(h.priority), h.name, (h.keywords || []).join(", ")]),
    );
    return;
  }

  if (sub === "add") {
    const id = requireId(args[1], "hubs add <siteId> --name <name>");
    if (id == null) return;
    const body = hubBodyFromFlags(ctx.flags);
    if (!body.name) {
      console.error("A hub needs --name.");
      process.exitCode = 1;
      return;
    }
    const hub = await client.post(`/sites/${id}/hubs`, { body });
    if (ctx.json) return printJson(hub);
    success(`Added hub #${hub.id}: ${hub.name}`);
    return;
  }

  if (sub === "edit") {
    const id = requireId(args[1], "hubs edit <hubId> [--name --description --keywords --priority]");
    if (id == null) return;
    const hub = await client.patch(`/hubs/${id}`, { body: hubBodyFromFlags(ctx.flags) });
    if (ctx.json) return printJson(hub);
    printHub(hub);
    return;
  }

  if (sub === "archive" || sub === "restore") {
    const id = requireId(args[1], `hubs ${sub} <hubId>`);
    if (id == null) return;
    const hub = await client.post(`/hubs/${id}/${sub}`, {});
    if (ctx.json) return printJson(hub);
    success(`Hub #${hub.id} is now ${hub.status}.`);
    return;
  }

  console.error("Unknown hubs command. Try: list, add, edit, archive, restore.");
  process.exitCode = 1;
}
