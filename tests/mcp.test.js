// The MCP server: JSON-RPC handshake, tool discovery, tool calls routed to the
// API client, and error surfaces (missing args, missing key, API errors) that
// come back as readable tool results instead of protocol failures.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createMcpServer, TOOLS } from "../lib/mcp.js";
import { makeClient, ApiError } from "../lib/client.js";

function server(fetchImpl) {
  return createMcpServer({
    getClient: () => makeClient({ apiKey: "rg_test", apiUrl: "https://x.test/api/v1" }),
    version: "9.9.9",
  });
}

async function withFetch(fetchImpl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

test("initialize handshake reports tools capability and server info", async () => {
  const handle = server();
  const res = await handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  assert.equal(res.result.protocolVersion, "2025-06-18");
  assert.deepEqual(res.result.capabilities, { tools: {} });
  assert.equal(res.result.serverInfo.name, "rankgoat");
  assert.equal(res.result.serverInfo.version, "9.9.9");
});

test("tools/list exposes every tool with a valid input schema", async () => {
  const handle = server();
  const res = await handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal(res.result.tools.length, TOOLS.length);
  const names = res.result.tools.map((t) => t.name);
  for (const expected of ["whoami", "list_plan", "generate_post", "approve_post", "get_backlinks", "get_job_status"]) {
    assert.ok(names.includes(expected), `missing tool ${expected}`);
  }
  for (const t of res.result.tools) {
    assert.equal(t.inputSchema.type, "object");
    assert.ok(t.description.length > 10);
  }
});

test("tools/call hits the API with bearer auth and returns JSON text content", async () => {
  const calls = [];
  await withFetch(
    async (url, opts) => {
      calls.push({ url: String(url), opts });
      return new Response(JSON.stringify({ siteId: 5, month: "2026-07", items: [] }), { status: 200 });
    },
    async () => {
      const handle = server();
      const res = await handle({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "list_plan", arguments: { siteId: 5, month: "2026-07" } },
      });
      assert.equal(calls[0].url, "https://x.test/api/v1/sites/5/plan?month=2026-07");
      assert.equal(calls[0].opts.headers.Authorization, "Bearer rg_test");
      assert.ok(!res.result.isError);
      assert.deepEqual(JSON.parse(res.result.content[0].text), { siteId: 5, month: "2026-07", items: [] });
    },
  );
});

test("tools/call: missing required args come back as a tool error, not a crash", async () => {
  const handle = server();
  const res = await handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_site", arguments: {} } });
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /siteId/);
});

test("tools/call: API errors surface as readable tool errors", async () => {
  await withFetch(
    async () =>
      new Response(JSON.stringify({ error: { code: "not_found", message: "No such site." } }), { status: 404 }),
    async () => {
      const handle = server();
      const res = await handle({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "get_site", arguments: { siteId: 999 } },
      });
      assert.equal(res.result.isError, true);
      assert.match(res.result.content[0].text, /not_found/);
      assert.match(res.result.content[0].text, /No such site/);
    },
  );
});

test("tools/call: a missing API key is a readable tool error", async () => {
  const prev = process.env.RANKGOAT_API_KEY;
  const prevDir = process.env.RANKGOAT_CONFIG_DIR;
  delete process.env.RANKGOAT_API_KEY;
  process.env.RANKGOAT_CONFIG_DIR = "/nonexistent/rankgoat-test";
  try {
    const handle = createMcpServer({ getClient: () => makeClient({}), version: "9.9.9" });
    const res = await handle({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "whoami", arguments: {} } });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /no_api_key/);
  } finally {
    if (prev !== undefined) process.env.RANKGOAT_API_KEY = prev;
    if (prevDir === undefined) delete process.env.RANKGOAT_CONFIG_DIR;
    else process.env.RANKGOAT_CONFIG_DIR = prevDir;
  }
});

test("unknown methods error, notifications are silently ignored", async () => {
  const handle = server();
  const res = await handle({ jsonrpc: "2.0", id: 7, method: "resources/list" });
  assert.equal(res.error.code, -32601);
  assert.equal(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.equal(await handle({ not: "jsonrpc" }), null);
});
