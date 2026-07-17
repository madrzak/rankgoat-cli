# RankGoat CLI

The official command-line interface for **[RankGoat](https://rankgoat.app)**, the SEO backlink exchange that writes and publishes done-for-you blog posts with real dofollow links between member sites.

Manage your content plan, generate posts, approve drafts, and read your backlink and SEO data straight from the terminal or a CI pipeline. Built on the public [RankGoat API](https://rankgoat.app/docs/api).

[![npm](https://img.shields.io/npm/v/rankgoat.svg)](https://www.npmjs.com/package/rankgoat)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## Install

```bash
npm install -g rankgoat
```

Or run it without installing:

```bash
npx rankgoat whoami
```

Requires Node.js 20 or newer. Zero runtime dependencies.

## Authenticate

Create an API key at **[rankgoat.app/app/settings#api](https://rankgoat.app/app/settings#api)**, then:

```bash
rankgoat auth login rg_live_xxxxxxxx
```

The key is stored in `~/.rankgoat/config.json` (owner-readable only). Alternatively set `RANKGOAT_API_KEY` in your environment, or pass `--api-key` on any command, handy for CI.

```bash
export RANKGOAT_API_KEY=rg_live_xxxxxxxx
rankgoat whoami
```

## Usage

```text
rankgoat <command> [args] [options]
```

### Account & sites

```bash
rankgoat whoami                     # member + sites with credit balances
rankgoat sites                      # list your sites
rankgoat sites get 123              # one site, full detail
rankgoat sites credits 123          # credit balance by bucket
```

### Content plan

The monthly plan is a calendar of briefs the AI turns into posts.

```bash
rankgoat plan list 123 --month 2026-06
rankgoat plan add 123 --auto                       # let AI plan a brief (async)
rankgoat plan add 123 --title "Notion vs Obsidian" --keyword "notion alternatives" --type comparison --hub 5
rankgoat plan edit 789 --title "Notion vs Obsidian (2026)" --type guide
rankgoat plan schedule 789 2026-06-22
rankgoat plan archive 789
rankgoat plan restore 789
rankgoat plan generate 789 --wait                  # write the post now (spends 1 credit)
```

### Posts

```bash
rankgoat posts list 123 --status draft
rankgoat posts get 456 --html                      # print the post body
rankgoat posts approve 456                          # approve a draft for publishing
```

### Backlinks & SEO

```bash
rankgoat backlinks 123                              # inbound + outbound link graph
rankgoat mentions 123                               # brand mentions received + given
rankgoat seo authority 123                          # Domain Rating over time
rankgoat seo onpage 123
rankgoat seo sitemap 123
rankgoat seo gsc 123                                # Google Search Console performance
rankgoat seo equity 123                             # link-equity points: balances + ledger
rankgoat seo flywheel 123                           # unindexed-post fixes awaiting review
```

### Content hubs

Topic clusters the monthly planner draws briefs from, weighted by priority.

```bash
rankgoat hubs list 123
rankgoat hubs add 123 --name "AI note-taking" --keywords "ai notes, ai note app" --priority high
rankgoat hubs edit 5 --priority low
rankgoat hubs archive 5                             # the planner stops drawing from it
rankgoat hubs restore 5
```

### Product features

Your product's real capabilities. They ground content generation, so posts never invent features the product does not have.

```bash
rankgoat features list 123
rankgoat features add 123 --name "Offline sync" --description "Notes sync without a connection"
rankgoat features edit 7 --description "Now with conflict resolution"
rankgoat features archive 7                         # new posts stop mentioning it
rankgoat features restore 7
```

### Jobs

Some actions (AI planning, post generation) run in the background and return a job handle. Poll it, or pass `--wait` on the original command:

```bash
rankgoat jobs plan-generate 789 --wait
```

## Options

| Option | Description |
| --- | --- |
| `--api-key <key>` | Use this key (overrides env and saved config) |
| `--api-url <url>` | Override the API base URL (defaults to `https://rankgoat.app/api/v1`) |
| `--json` | Output raw JSON, ideal for scripting with `jq` |
| `--wait` | Block until an async job finishes |
| `-h, --help` | Show help |
| `-v, --version` | Show the CLI version |

## Scripting

Every command supports `--json` for machine-readable output:

```bash
rankgoat sites --json | jq '.sites[] | select(.status=="active") | .domain'
```

Exit code is non-zero on any API or usage error, so it composes cleanly in CI.

## For AI agents

The CLI is built to be driven by agents: structured JSON on every command, env-var auth, and non-zero exits on failure. Two ways to plug in:

**MCP server.** `rankgoat mcp` runs a Model Context Protocol server on stdio exposing all 34 capabilities (plan, generate, approve, backlinks, mentions, DR, GSC, sitemap, hubs, features, link equity, flywheel) as typed tools:

```bash
claude mcp add rankgoat -e RANKGOAT_API_KEY=rg_live_... -- npx -y rankgoat mcp
```

Or in any MCP client config:

```json
{
  "mcpServers": {
    "rankgoat": {
      "command": "npx",
      "args": ["-y", "rankgoat", "mcp"],
      "env": { "RANKGOAT_API_KEY": "rg_live_..." }
    }
  }
}
```

**Shell + SKILL.md.** Agents that run shell commands can use the CLI directly; the bundled [SKILL.md](./SKILL.md) teaches them the workflows, including which calls spend credits and where to keep a human in the loop.

More at [rankgoat.app/agent](https://rankgoat.app/agent).

## How RankGoat works

RankGoat members pay for done-for-you blog posts that get published on their own sites with dofollow outbound links to other members. The link graph is non-reciprocal and niche/DR-matched, so it builds real authority without pattern-matching as a scheme. Learn more at **[rankgoat.app](https://rankgoat.app)** or read the [API reference](https://rankgoat.app/docs/api).

## License

[MIT](./LICENSE) © [RedStudio](https://rankgoat.app)
