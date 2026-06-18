// rankgoat backlinks <siteId> — the site's inbound + outbound link graph.
import { printJson, table, heading, status, dash } from "../output.js";
import { requireId } from "./sites.js";

export default async function run(args, ctx) {
  const client = ctx.getClient();
  const id = requireId(args[0], "backlinks <siteId>");
  if (id == null) return;

  const data = await client.get(`/sites/${id}/backlinks`);
  if (ctx.json) return printJson(data);

  heading(`Inbound (${data.inbound.length})`);
  if (data.inbound.length) {
    table(
      ["FROM", "DR", "ANCHOR", "STATUS", "URL"],
      data.inbound.map((l) => [l.sourceDomain, dash(l.sourceDr), dash(l.anchor), status(l.status), dash(l.url)]),
    );
  } else {
    console.log("None yet.");
  }
  console.log();
  heading(`Outbound (${data.outbound.length})`);
  if (data.outbound.length) {
    table(
      ["TO", "ANCHOR", "STATUS", "URL"],
      data.outbound.map((l) => [l.targetDomain, dash(l.anchor), status(l.status), dash(l.url)]),
    );
  } else {
    console.log("None yet.");
  }
}
