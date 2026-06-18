// rankgoat sites — read a member's sites.
//   sites [list]        all sites
//   sites get <id>      one site, full detail
//   sites credits <id>  credit balance by bucket
import { printJson, table, kv, status, dash, c } from "../output.js";

export default async function run(args, ctx) {
  const client = ctx.getClient();
  const sub = args[0] || "list";

  if (sub === "list") {
    const { sites } = await client.get("/sites");
    if (ctx.json) return printJson({ sites });
    if (!sites.length) return console.log("No sites yet.");
    table(
      ["ID", "DOMAIN", "STATUS", "NICHE", "DR", "MODE"],
      sites.map((s) => [
        s.id,
        s.domain,
        status(s.status),
        dash(s.niche),
        dash(s.authorityScore),
        dash(s.publishing?.mode),
      ]),
    );
    return;
  }

  if (sub === "get") {
    const id = requireId(args[1], "sites get <id>");
    if (id == null) return;
    const s = await client.get(`/sites/${id}`);
    if (ctx.json) return printJson(s);
    kv([
      ["ID", s.id],
      ["Domain", s.domain],
      ["Status", status(s.status)],
      ["Niche", dash(s.niche)],
      ["Keywords", Array.isArray(s.keywords) ? s.keywords.join(", ") : dash(s.keywords)],
      ["Tone", dash(s.tone)],
      ["Domain Rating", `${dash(s.authorityScore)}  ${c.gray(`(baseline ${s.authorityStart ?? "-"})`)}`],
      ["Created", dash(s.createdAt)],
      ["Activated", dash(s.activatedAt)],
      ["Publishing", s.publishing ? `${s.publishing.mode} (auto-publish ${s.publishing.autoPublishEnabled ? "on" : "off"})` : dash(null)],
    ]);
    return;
  }

  if (sub === "credits") {
    const id = requireId(args[1], "sites credits <id>");
    if (id == null) return;
    const cr = await client.get(`/sites/${id}/credits`);
    if (ctx.json) return printJson(cr);
    kv([
      ["Balance", c.bold(cr.balance)],
      ["Subscription", cr.subscription],
      ["Purchased", cr.purchased],
      ["Monthly allotment", cr.allotment],
    ]);
    return;
  }

  console.error(`Unknown sites command: ${sub}. Try: list, get, credits.`);
  process.exitCode = 1;
}

export function requireId(value, usage) {
  if (value == null || value === "") {
    console.error(`Usage: rankgoat ${usage}`);
    process.exitCode = 1;
    return null;
  }
  return value;
}
