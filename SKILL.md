---
name: rankgoat
description: Run SEO for a website through RankGoat - plan content, generate and approve blog posts, and track backlinks, Domain Rating, sitemap health, and Search Console data. Use when the user asks about their site's SEO, content calendar, blog posts, backlinks, or rankings and they have a RankGoat account.
---

# RankGoat for AI agents

RankGoat (https://rankgoat.app) is an SEO backlink exchange: it writes and
publishes done-for-you blog posts on member sites, with real dofollow links
between niche-matched members. This skill drives it through the `rankgoat` CLI.

## Setup

The CLI needs Node 20+ and an API key (the user creates one at
https://rankgoat.app/app/settings#api):

```bash
export RANKGOAT_API_KEY=rg_live_...   # or: rankgoat auth login rg_live_...
npx -y rankgoat whoami --json         # verify auth; also lists site IDs
```

Always pass `--json`: every command then prints machine-readable JSON on
stdout. Errors are `{ "error": { "code", "message" } }` shapes with a non-zero
exit code.

## Discover before you act

Site IDs scope almost everything. Start every session with:

```bash
rankgoat whoami --json                # member, sites, credit balances
rankgoat sites get <siteId> --json    # one site in full detail
rankgoat sites credits <siteId> --json
```

## Core workflows

**Read the SEO picture** (safe, read-only):

```bash
rankgoat backlinks <siteId> --json         # inbound/outbound dofollow link graph
rankgoat mentions <siteId> --json          # brand mentions (the GEO half of placements)
rankgoat seo authority <siteId> --json     # Domain Rating history (weekly)
rankgoat seo onpage <siteId> --json        # on-page crawl findings
rankgoat seo sitemap <siteId> --json       # sitemap audit, broken URLs
rankgoat seo gsc <siteId> --json           # Search Console queries/clicks
rankgoat seo equity <siteId> --json        # link-equity points: balances + ledger
rankgoat seo flywheel <siteId> --json      # unindexed-post fixes awaiting review
```

**Manage the content plan** (the monthly calendar of briefs the AI writes from):

```bash
rankgoat plan list <siteId> --json [--month 2026-07]
rankgoat plan add <siteId> --auto --json               # AI plans a brief (async job)
rankgoat plan add <siteId> --title "..." --keyword "..." --json
rankgoat plan edit <itemId> --title "..." --json
rankgoat plan schedule <itemId> 2026-07-25 --json
```

**Generate and ship posts**:

```bash
rankgoat plan generate <itemId> --wait --json   # writes the post. COSTS 1 CREDIT, takes 1-3 min
rankgoat posts list <siteId> --json [--status draft]
rankgoat posts get <postId> --html --json
rankgoat posts approve <postId> --json          # releases the post toward publishing
```

**Steer the planner** with hubs (topic clusters) and product features:

```bash
rankgoat hubs list <siteId> --json
rankgoat hubs add <siteId> --name "..." --keywords "a, b" --priority high --json
rankgoat features list <siteId> --json
rankgoat features add <siteId> --name "..." --description "..." --json
```

**Async jobs**: `plan add --auto` and `plan generate` return a job handle
unless you pass `--wait`. Poll with:

```bash
rankgoat jobs <kind> <target> --wait --json
```

## MCP alternative

If your runtime speaks Model Context Protocol instead of shell, the same
capabilities are available as 34 typed MCP tools:

```bash
claude mcp add rankgoat -e RANKGOAT_API_KEY=rg_live_... -- npx -y rankgoat mcp
```

## Rules for agents

- `plan generate` spends one of the user's credits per post. Check
  `sites credits` first and don't burn credits without being asked.
- `posts approve` makes content go live on the user's real website. Keep a
  human in the loop: show them the draft (or at least the title and outline)
  before approving, unless they've explicitly delegated approval.
- Everything else (reads, planning, editing briefs, hubs, features) is cheap
  and reversible - use freely.
- Full API reference: https://rankgoat.app/docs/api
