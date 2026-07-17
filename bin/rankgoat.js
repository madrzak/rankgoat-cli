#!/usr/bin/env node
// RankGoat CLI entry point. Parses one global option schema (covers every
// command's flags), then dispatches the first positional to a lazily-imported
// command module. All API/usage errors funnel through the catch in main().

import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ApiError, makeClient } from "../lib/client.js";
import { c } from "../lib/output.js";

const COMMANDS = {
  whoami: () => import("../lib/commands/whoami.js"),
  auth: () => import("../lib/commands/auth.js"),
  sites: () => import("../lib/commands/sites.js"),
  plan: () => import("../lib/commands/plan.js"),
  posts: () => import("../lib/commands/posts.js"),
  backlinks: () => import("../lib/commands/backlinks.js"),
  seo: () => import("../lib/commands/seo.js"),
  hubs: () => import("../lib/commands/hubs.js"),
  features: () => import("../lib/commands/features.js"),
  jobs: () => import("../lib/commands/jobs.js"),
  mcp: () => import("../lib/commands/mcp.js"),
};

// One schema for parseArgs. Unknown flags would otherwise throw, so every flag
// any command accepts is declared here.
const OPTIONS = {
  "api-key": { type: "string" },
  "api-url": { type: "string" },
  json: { type: "boolean" },
  wait: { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  month: { type: "string" },
  auto: { type: "boolean" },
  title: { type: "string" },
  keyword: { type: "string" },
  meta: { type: "string" },
  type: { type: "string" },
  intent: { type: "string" },
  angle: { type: "string" },
  date: { type: "string" },
  status: { type: "string" },
  html: { type: "boolean" },
  hub: { type: "string" },
  name: { type: "string" },
  description: { type: "string" },
  keywords: { type: "string" },
  priority: { type: "string" },
};

const USAGE = `${c.bold("rankgoat")} - official CLI for RankGoat (https://rankgoat.app)

Usage: rankgoat <command> [args] [options]

Commands:
  whoami                            Show the authenticated member and their sites
  auth login <key>                  Save an API key   (also: auth status, auth logout)
  sites [list]                      List your sites
  sites get <id>                    Show one site
  sites credits <id>                Show credit balance for a site
  plan list <siteId> [--month]      List the month's content briefs
  plan add <siteId> --auto          Let AI plan a brief (or --title ... for a manual one)
  plan edit <itemId> [--title ...]  Edit a planned brief
  plan schedule <itemId> <date>     Schedule a brief (YYYY-MM-DD)
  plan archive|restore <itemId>     Archive / restore a brief
  plan generate <itemId> [--wait]   Write the post for a brief (spends 1 credit)
  posts list <siteId> [--status]    List generated posts
  posts get <postId> [--html]       Show one post (--html prints the body)
  posts approve <postId>            Approve a drafted post for publishing
  backlinks <siteId>                Show the inbound + outbound link graph
  seo onpage|sitemap|authority|gsc <siteId>
                                    Read SEO data the platform tracks
  hubs list <siteId>                List content hubs (topic clusters)
  hubs add <siteId> --name <n>      Create a hub (--keywords "a, b" --priority high)
  hubs edit <hubId> [--name ...]    Edit a hub
  hubs archive|restore <hubId>      Retire / reactivate a hub
  features list <siteId>            List product features (ground content generation)
  features add <siteId> --name <n>  Add a feature (--description ...)
  features edit <featureId>         Edit a feature
  features archive|restore <featureId>
                                    Retire / reactivate a feature
  jobs <kind> <target> [--wait]     Poll an async job
  mcp                               Run the MCP server on stdio (for AI agents)

Global options:
  --api-key <key>   Use this key (overrides env + saved config)
  --api-url <url>   Override the API base URL
  --json            Output raw JSON (machine-readable)
  --wait            Block until an async job finishes
  -h, --help        Show this help
  -v, --version     Show the CLI version

Auth: create a key at https://rankgoat.app/app/settings#api, then run
  rankgoat auth login rg_live_...
Docs: https://rankgoat.app/docs/api`;

function version() {
  const dir = dirname(fileURLToPath(import.meta.url));
  try {
    return JSON.parse(readFileSync(join(dir, "../package.json"), "utf8")).version;
  } catch {
    return "0.0.0";
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: argv,
    options: OPTIONS,
    allowPositionals: true,
  });

  if (values.version) return console.log(version());

  const command = positionals[0];
  if (!command || values.help) {
    console.log(USAGE);
    process.exitCode = command ? 0 : values.help ? 0 : 1;
    return;
  }

  const loader = COMMANDS[command];
  if (!loader) {
    console.error(`Unknown command: ${command}\nRun "rankgoat --help" for usage.`);
    process.exitCode = 1;
    return;
  }

  // Normalize flags: parseArgs uses kebab-case keys; commands read camelCase for
  // the two client settings, the rest pass through as-is.
  const flags = {
    ...values,
    apiKey: values["api-key"],
    apiUrl: values["api-url"],
  };

  const ctx = {
    flags,
    json: !!values.json,
    version: version(),
    getClient: () => makeClient({ apiKey: flags.apiKey, apiUrl: flags.apiUrl }),
  };

  const mod = await loader();
  await mod.default(positionals.slice(1), ctx);
}

main().catch((err) => {
  if (err instanceof ApiError) {
    console.error(`${c.red("Error")} ${c.gray(`[${err.code}${err.status ? " " + err.status : ""}]`)}: ${err.message}`);
  } else {
    console.error(`${c.red("Error")}: ${err.message}`);
  }
  process.exitCode = 1;
});
