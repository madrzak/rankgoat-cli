// rankgoat seo - read-only SEO data the platform tracks per site.
//   seo onpage <siteId>     cached on-page audit summary
//   seo sitemap <siteId>    latest sitemap audit
//   seo authority <siteId>  Domain Rating: current, baseline, history
//   seo gsc <siteId>        cached Google Search Console performance
//   seo hubs <siteId>       content hubs
//   seo equity <siteId>     link-equity points: balances + ledger
//   seo flywheel <siteId>   flywheel suggestions + action log
import { printJson, kv, heading, dash, c } from "../output.js";
import { requireId } from "./sites.js";

const ENDPOINTS = {
  onpage: { path: "on-page", key: "summary" },
  sitemap: { path: "sitemap", key: "audit" },
  authority: { path: "authority", key: null },
  gsc: { path: "gsc", key: "gsc" },
  hubs: { path: "hubs", key: "hubs" },
  equity: { path: "equity", key: null },
  flywheel: { path: "flywheel", key: null },
};

export default async function run(args, ctx) {
  const client = ctx.getClient();
  const sub = args[0];
  const ep = ENDPOINTS[sub];
  if (!ep) {
    console.error(`Unknown seo command: ${sub}. Try: onpage, sitemap, authority, gsc, hubs, equity, flywheel.`);
    process.exitCode = 1;
    return;
  }
  const id = requireId(args[1], `seo ${sub} <siteId>`);
  if (id == null) return;

  const data = await client.get(`/sites/${id}/${ep.path}`);
  if (ctx.json) return printJson(data);

  if (sub === "authority") {
    kv([
      ["Current DR", c.bold(dash(data.current))],
      ["Baseline DR", dash(data.baseline)],
      ["History points", Array.isArray(data.history) ? data.history.length : 0],
    ]);
    return;
  }

  if (sub === "equity") {
    kv([
      ["Balance", c.bold(dash(data.balance))],
      ["Allowance (monthly)", dash(data.allowance)],
      ["Earned", dash(data.earned)],
      ["Lifetime earned", dash(data.lifetimeEarned)],
      ["Enforced", data.enforced ? "yes" : "not yet"],
      ["Ledger entries", Array.isArray(data.ledger) ? data.ledger.length : 0],
    ]);
    return;
  }

  if (sub === "flywheel") {
    kv([
      ["Suggestions awaiting review", Array.isArray(data.suggested) ? data.suggested.length : 0],
      ["Recent log entries", Array.isArray(data.log) ? data.log.length : 0],
    ]);
    if (data.suggested && data.suggested.length) {
      heading("Suggested improvements");
      console.log(JSON.stringify(data.suggested, null, 2));
    }
    return;
  }

  const payload = data[ep.key];
  if (payload == null || (Array.isArray(payload) && !payload.length)) {
    console.log(c.gray(`No ${sub} data yet.`));
    return;
  }
  // These payloads vary in shape; print them readably without guessing fields.
  heading(`${sub} - site ${data.siteId}`);
  console.log(JSON.stringify(payload, null, 2));
}
