// rankgoat mentions <siteId> - plain-text brand mentions, the GEO half of
// placements (the network alternates 1:1 between dofollow links and mentions).
import { printJson, table, kv, status, note } from "../output.js";
import { requireId } from "./sites.js";

export default async function run(args, ctx) {
  const id = requireId(args[0], "mentions <siteId>");
  if (id == null) return;
  const data = await ctx.getClient().get(`/sites/${id}/mentions`);
  if (ctx.json) return printJson(data);

  kv([
    ["Total received", data.stats.total],
    ["Live", data.stats.live],
    ["Unique domains", data.stats.domains],
  ]);

  note("\nReceived (your brand on member sites)");
  if (!data.received.length) console.log("None yet.");
  else
    table(
      ["ID", "SOURCE", "BRAND TEXT", "STATUS", "URL"],
      data.received.map((m) => [m.id, m.sourceDomain, m.brandText, status(m.status), m.url || ""]),
    );

  note("\nGiven (mentions your posts carry)");
  if (!data.given.length) console.log("None yet.");
  else
    table(
      ["ID", "TARGET", "BRAND TEXT", "STATUS", "URL"],
      data.given.map((m) => [m.id, m.targetDomain, m.brandText, status(m.status), m.url || ""]),
    );
}
