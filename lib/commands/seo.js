// rankgoat seo — read-only SEO data the platform tracks per site.
//   seo onpage <siteId>     cached on-page audit summary
//   seo sitemap <siteId>    latest sitemap audit
//   seo authority <siteId>  Domain Rating: current, baseline, history
//   seo gsc <siteId>        cached Google Search Console performance
//   seo hubs <siteId>       content hubs
import { printJson, kv, heading, dash, c } from "../output.js";
import { requireId } from "./sites.js";

const ENDPOINTS = {
  onpage: { path: "on-page", key: "summary" },
  sitemap: { path: "sitemap", key: "audit" },
  authority: { path: "authority", key: null },
  gsc: { path: "gsc", key: "gsc" },
  hubs: { path: "hubs", key: "hubs" },
};

export default async function run(args, ctx) {
  const client = ctx.getClient();
  const sub = args[0];
  const ep = ENDPOINTS[sub];
  if (!ep) {
    console.error(`Unknown seo command: ${sub}. Try: onpage, sitemap, authority, gsc, hubs.`);
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

  const payload = data[ep.key];
  if (payload == null || (Array.isArray(payload) && !payload.length)) {
    console.log(c.gray(`No ${sub} data yet.`));
    return;
  }
  // These payloads vary in shape; print them readably without guessing fields.
  heading(`${sub} — site ${data.siteId}`);
  console.log(JSON.stringify(payload, null, 2));
}
