# CLAUDE.md — apps/cli

The official open-source RankGoat CLI (npm package `rankgoat`). It's a thin client over the public JSON API at `/api/v1` (defined in `apps/server/src/controllers/api/*` and documented at `/docs/api`). Published to npm and mirrored to a public GitHub repo — partly a real product surface, partly an SEO/DR play (README links back to rankgoat.app).

## Rules

- **Self-contained.** No imports from `apps/server` or other workspace packages. The directory must work as its own standalone public repo.
- **Zero runtime dependencies.** Node 22 ESM, native `fetch`, `node:util` `parseArgs`. Don't add deps.
- **MIT licensed and public.** No secrets, no internal URLs, no private business logic. Default base URL is `https://rankgoat.app/api/v1`.
- Keep it in sync with the API: if an `/api/v1` endpoint changes shape, update the matching command + the README.

## Shape

```
bin/rankgoat.js        entry: one parseArgs schema (all flags), dispatch positional[0] → command module, central error catch
lib/config.js          key/base-URL resolution (flag > env > ~/.rankgoat/config.json > default) + the only writer
lib/client.js          fetch wrapper; success body as-is, { error: {code,message} } → thrown ApiError
lib/output.js          zero-dep ANSI colors, table(), kv(), status() — all human output goes through here; --json bypasses it
lib/poll.js            waitForJob(): poll /jobs until status !== "running"
lib/commands/*.js      one module per top-level command; export default async run(args, ctx). ctx = { flags, json, getClient() }
```

## Commands

`pnpm --filter rankgoat test` (node:test, network stubbed via `globalThis.fetch`). `node bin/rankgoat.js --help` for the surface.
