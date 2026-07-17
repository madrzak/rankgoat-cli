// Model Context Protocol server over stdio (JSON-RPC 2.0, one message per
// line). `rankgoat mcp` turns the RankGoat API into typed tools any MCP client
// (Claude Code, Cursor, Windsurf, custom agents) can call. Zero deps: the
// protocol surface we need (initialize, tools/list, tools/call, ping) is small
// enough to speak by hand. All human/log output goes to stderr - stdout is the
// protocol channel.

import { createInterface } from "node:readline";
import { ApiError } from "./client.js";

const PROTOCOL_VERSION = "2025-06-18";

const num = (description) => ({ type: "number", description });
const str = (description) => ({ type: "string", description });
const bool = (description) => ({ type: "boolean", description });

// Shared property sets, mirrored from the CLI commands / API field names.
const BRIEF_PROPS = {
  title: str("Post title"),
  targetKeyword: str("Primary keyword the post should rank for"),
  metaDescription: str("Meta description"),
  type: str("Post type from the catalog (e.g. how-to, listicle, comparison)"),
  intent: str("Search intent (informational, commercial, transactional)"),
  productAngle: str("How the post ties back to the site's product"),
  scheduledFor: str("Publish date, YYYY-MM-DD"),
  hubId: num("Content hub ID to attach the brief to"),
};

// One entry per tool: name, description, JSON-Schema input, and the API call.
// Descriptions tell the agent what a call costs and what to do next, because
// that context never travels in the schema alone.
export const TOOLS = [
  {
    name: "whoami",
    description: "The authenticated RankGoat member and their sites with credit balances. Call first to discover site IDs.",
    props: {},
    run: (c) => c.get("/me"),
  },
  {
    name: "list_sites",
    description: "List the member's sites (domain, status, Domain Rating, credits).",
    props: {},
    run: (c) => c.get("/sites"),
  },
  {
    name: "get_site",
    description: "Full detail for one site.",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}`),
  },
  {
    name: "get_credits",
    description: "Credit balance for a site, split by bucket (subscription resets monthly, purchased persists). Generating a post costs 1 credit.",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/credits`),
  },
  {
    name: "list_plan",
    description: "The month's content plan: briefs the AI will turn into posts (title, keyword, type, status, schedule).",
    props: { siteId: num("Site ID"), month: str("Month, YYYY-MM (defaults to current)") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/plan`, { query: { month: a.month } }),
  },
  {
    name: "plan_auto_brief",
    description: "Ask RankGoat's planner to add one AI-planned brief to the month. Async: returns a job handle - poll it with get_job_status.",
    props: { siteId: num("Site ID"), month: str("Month, YYYY-MM (defaults to current)") },
    required: ["siteId"],
    run: (c, a) => c.post(`/sites/${a.siteId}/plan`, { body: { mode: "auto", month: a.month } }),
  },
  {
    name: "add_brief",
    description: "Add a manually specified brief to the content plan. Only title is required; the generator fills sensible gaps.",
    props: { siteId: num("Site ID"), month: str("Month, YYYY-MM"), ...BRIEF_PROPS },
    required: ["siteId", "title"],
    run: (c, a) => {
      const { siteId, ...body } = a;
      return c.post(`/sites/${siteId}/plan`, { body });
    },
  },
  {
    name: "edit_brief",
    description: "Edit a planned brief before it's written. Pass only the fields to change.",
    props: { itemId: num("Brief (plan item) ID"), ...BRIEF_PROPS },
    required: ["itemId"],
    run: (c, a) => {
      const { itemId, ...body } = a;
      return c.patch(`/plan/${itemId}`, { body });
    },
  },
  {
    name: "schedule_brief",
    description: "Set the publish date for a brief.",
    props: { itemId: num("Brief ID"), date: str("YYYY-MM-DD") },
    required: ["itemId", "date"],
    run: (c, a) => c.post(`/plan/${a.itemId}/schedule`, { body: { date: a.date } }),
  },
  {
    name: "archive_brief",
    description: "Archive (skip) a planned brief.",
    props: { itemId: num("Brief ID") },
    required: ["itemId"],
    run: (c, a) => c.post(`/plan/${a.itemId}/archive`, {}),
  },
  {
    name: "restore_brief",
    description: "Restore an archived brief to the plan.",
    props: { itemId: num("Brief ID") },
    required: ["itemId"],
    run: (c, a) => c.post(`/plan/${a.itemId}/restore`, {}),
  },
  {
    name: "generate_post",
    description: "Write the full post for a brief. SPENDS 1 CREDIT. Async and slow (1-3 minutes): returns a job handle - poll it with get_job_status. The finished post lands in the review queue; a human approves it before it publishes.",
    props: { itemId: num("Brief ID") },
    required: ["itemId"],
    run: (c, a) => c.post(`/plan/${a.itemId}/generate`, {}),
  },
  {
    name: "list_posts",
    description: "List a site's generated posts with status (draft, ready_to_publish, published, verified), translation grouping, and Google index coverage (indexState). Archived posts are excluded unless includeArchived is set.",
    props: { siteId: num("Site ID"), status: str("Filter by status"), includeArchived: bool("Also list archived posts") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/posts`, { query: { status: a.status, includeArchived: a.includeArchived ? 1 : undefined } }),
  },
  {
    name: "get_post",
    description: "One post's metadata; set includeHtml to also get the full body HTML.",
    props: { postId: num("Post ID"), includeHtml: bool("Include the post body HTML") },
    required: ["postId"],
    run: (c, a) => c.get(`/posts/${a.postId}`, { query: a.includeHtml ? { html: 1 } : undefined }),
  },
  {
    name: "approve_post",
    description: "Approve a drafted post for publishing. This makes content go live on the member's site - confirm with the human before calling unless they've delegated approval.",
    props: { postId: num("Post ID") },
    required: ["postId"],
    run: (c, a) => c.post(`/posts/${a.postId}/approve`, {}),
  },
  {
    name: "get_backlinks",
    description: "The site's inbound and outbound link graph: live dofollow backlinks, sources, anchors, status. Links are half of placements; see get_mentions for the other half.",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/backlinks`),
  },
  {
    name: "get_mentions",
    description: "Plain-text brand mentions received and given (the GEO half of placements; the network alternates 1:1 between links and mentions), with live counts.",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/mentions`),
  },
  {
    name: "get_onpage",
    description: "On-page SEO crawl results for the site's pages (titles, metas, issues).",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/on-page`),
  },
  {
    name: "get_sitemap_report",
    description: "Latest sitemap audit: page count, broken URLs, submission status.",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/sitemap`),
  },
  {
    name: "get_authority",
    description: "Domain Rating history (Ahrefs DR, refreshed weekly).",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/authority`),
  },
  {
    name: "get_gsc",
    description: "Google Search Console data for the site (queries, clicks, impressions), if connected.",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/gsc`),
  },
  {
    name: "get_link_equity",
    description: "The link-equity points economy for a site: hosting placements for other members earns points, receiving placements spends them. Returns balances (allowance resets monthly, earned persists), whether equity currently gates new placements (enforced), and a readable ledger.",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/equity`),
  },
  {
    name: "get_flywheel",
    description: "The content flywheel for a site: posts stuck out of Google's index get an internal-link boost, then a proposed content refresh. Returns suggestions awaiting human review (nothing auto-applies) and the recent action log.",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/flywheel`),
  },
  {
    name: "list_hubs",
    description: "Content hubs (topic clusters) the planner writes toward.",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/hubs`),
  },
  {
    name: "add_hub",
    description: "Create a content hub to steer the planner toward a topic.",
    props: {
      siteId: num("Site ID"),
      name: str("Hub name/topic"),
      description: str("What the hub covers"),
      keywords: str("Comma-separated seed keywords"),
      priority: str("low | normal | high"),
    },
    required: ["siteId", "name"],
    run: (c, a) => {
      const { siteId, ...body } = a;
      return c.post(`/sites/${siteId}/hubs`, { body });
    },
  },
  {
    name: "edit_hub",
    description: "Edit a content hub. Pass only the fields to change.",
    props: {
      hubId: num("Hub ID"),
      name: str("Hub name/topic"),
      description: str("What the hub covers"),
      keywords: str("Comma-separated seed keywords"),
      priority: str("low | normal | high"),
    },
    required: ["hubId"],
    run: (c, a) => {
      const { hubId, ...body } = a;
      return c.patch(`/hubs/${hubId}`, { body });
    },
  },
  {
    name: "archive_hub",
    description: "Retire a content hub.",
    props: { hubId: num("Hub ID") },
    required: ["hubId"],
    run: (c, a) => c.post(`/hubs/${a.hubId}/archive`, {}),
  },
  {
    name: "restore_hub",
    description: "Reactivate an archived hub.",
    props: { hubId: num("Hub ID") },
    required: ["hubId"],
    run: (c, a) => c.post(`/hubs/${a.hubId}/restore`, {}),
  },
  {
    name: "list_features",
    description: "Product features on record for the site - they ground generated content in what the product actually does.",
    props: { siteId: num("Site ID") },
    required: ["siteId"],
    run: (c, a) => c.get(`/sites/${a.siteId}/features`),
  },
  {
    name: "add_feature",
    description: "Add a product feature so future posts can reference it accurately.",
    props: { siteId: num("Site ID"), name: str("Feature name"), description: str("What it does, in a sentence") },
    required: ["siteId", "name"],
    run: (c, a) => {
      const { siteId, ...body } = a;
      return c.post(`/sites/${siteId}/features`, { body });
    },
  },
  {
    name: "edit_feature",
    description: "Edit a product feature.",
    props: { featureId: num("Feature ID"), name: str("Feature name"), description: str("What it does") },
    required: ["featureId"],
    run: (c, a) => {
      const { featureId, ...body } = a;
      return c.patch(`/features/${featureId}`, { body });
    },
  },
  {
    name: "archive_feature",
    description: "Retire a product feature.",
    props: { featureId: num("Feature ID") },
    required: ["featureId"],
    run: (c, a) => c.post(`/features/${a.featureId}/archive`, {}),
  },
  {
    name: "restore_feature",
    description: "Reactivate an archived feature.",
    props: { featureId: num("Feature ID") },
    required: ["featureId"],
    run: (c, a) => c.post(`/features/${a.featureId}/restore`, {}),
  },
  {
    name: "get_job_status",
    description: "Status of an async job returned by plan_auto_brief or generate_post. Poll every ~10s until status is no longer 'running'.",
    props: { kind: str("Job kind from the job handle"), target: str("Job target from the job handle") },
    required: ["kind", "target"],
    run: (c, a) => c.get(`/jobs/${a.kind}/${a.target}`),
  },
];

function toolDef(t) {
  return {
    name: t.name,
    description: t.description,
    inputSchema: {
      type: "object",
      properties: t.props,
      ...(t.required && t.required.length ? { required: t.required } : {}),
      additionalProperties: false,
    },
  };
}

// The protocol core, transport-free so tests can drive it directly.
// getClient is lazy: tools/list works with no API key, and a missing key
// surfaces as a per-call tool error the agent can read and fix.
export function createMcpServer({ getClient, version = "0.0.0" }) {
  return async function handle(msg) {
    if (!msg || msg.jsonrpc !== "2.0") return null;
    const { id, method, params } = msg;
    const reply = (result) => ({ jsonrpc: "2.0", id, result });
    const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

    if (method === "initialize") {
      return reply({
        protocolVersion: (params && params.protocolVersion) || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "rankgoat", version },
      });
    }
    if (method === "ping") return reply({});
    if (method === "tools/list") return reply({ tools: TOOLS.map(toolDef) });

    if (method === "tools/call") {
      const tool = TOOLS.find((t) => t.name === (params && params.name));
      if (!tool) return fail(-32602, `Unknown tool: ${params && params.name}`);
      const args = (params && params.arguments) || {};
      const missing = (tool.required || []).filter((k) => args[k] == null);
      if (missing.length) {
        return reply({
          content: [{ type: "text", text: `Missing required argument(s): ${missing.join(", ")}` }],
          isError: true,
        });
      }
      try {
        const result = await tool.run(getClient(), args);
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (err) {
        const text =
          err instanceof ApiError
            ? `API error [${err.code}${err.status ? " " + err.status : ""}]: ${err.message}`
            : `Error: ${err.message}`;
        return reply({ content: [{ type: "text", text }], isError: true });
      }
    }

    // Notifications (no id) are fire-and-forget; unknown requests get an error.
    if (id === undefined || id === null) return null;
    return fail(-32601, `Method not found: ${method}`);
  };
}

// stdio transport: one JSON-RPC message per line in, one per line out.
export function serveStdio(ctx, version) {
  const handle = createMcpServer({ getClient: ctx.getClient, version });
  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      process.stdout.write(
        JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n",
      );
      return;
    }
    const res = await handle(msg);
    if (res) process.stdout.write(JSON.stringify(res) + "\n");
  });
  process.stderr.write(`rankgoat MCP server ready (${TOOLS.length} tools) - waiting for a client on stdio\n`);
  return new Promise((resolve) => rl.on("close", resolve));
}
