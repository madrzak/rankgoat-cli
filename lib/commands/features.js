// rankgoat features - the site's product features. They ground content
// generation: posts lean on real capabilities and never invent ones.
//   features list <siteId>
//   features add <siteId> --name <n> [--description <d>]
//   features edit <featureId> [--name --description]
//   features archive <featureId>
//   features restore <featureId>
import { printJson, table, kv, success, dash, c } from "../output.js";
import { requireId } from "./sites.js";

function featureBodyFromFlags(flags) {
  const body = {};
  if (flags.name != null) body.name = flags.name;
  if (flags.description != null) body.description = flags.description;
  return body;
}

export default async function run(args, ctx) {
  const client = ctx.getClient();
  const sub = args[0];

  if (sub === "list") {
    const id = requireId(args[1], "features list <siteId>");
    if (id == null) return;
    const data = await client.get(`/sites/${id}/features`);
    if (ctx.json) return printJson(data);
    if (!data.features.length) return console.log("No features yet.");
    table(
      ["ID", "STATUS", "NAME", "DESCRIPTION"],
      data.features.map((f) => [f.id, dash(f.status), f.name, dash(f.description)]),
    );
    return;
  }

  if (sub === "add") {
    const id = requireId(args[1], "features add <siteId> --name <name>");
    if (id == null) return;
    const body = featureBodyFromFlags(ctx.flags);
    if (!body.name) {
      console.error("A feature needs --name.");
      process.exitCode = 1;
      return;
    }
    const feature = await client.post(`/sites/${id}/features`, { body });
    if (ctx.json) return printJson(feature);
    success(`Added feature #${feature.id}: ${feature.name}`);
    return;
  }

  if (sub === "edit") {
    const id = requireId(args[1], "features edit <featureId> [--name --description]");
    if (id == null) return;
    const feature = await client.patch(`/features/${id}`, { body: featureBodyFromFlags(ctx.flags) });
    if (ctx.json) return printJson(feature);
    kv([
      ["ID", feature.id],
      ["Site", feature.site_id],
      ["Name", c.bold(feature.name)],
      ["Description", dash(feature.description)],
      ["Status", dash(feature.status)],
    ]);
    return;
  }

  if (sub === "archive" || sub === "restore") {
    const id = requireId(args[1], `features ${sub} <featureId>`);
    if (id == null) return;
    const feature = await client.post(`/features/${id}/${sub}`, {});
    if (ctx.json) return printJson(feature);
    success(`Feature #${feature.id} is now ${feature.status}.`);
    return;
  }

  console.error("Unknown features command. Try: list, add, edit, archive, restore.");
  process.exitCode = 1;
}
