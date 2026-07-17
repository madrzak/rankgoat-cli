import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSettings, DEFAULT_API_URL } from "../lib/config.js";
import { makeClient, ApiError } from "../lib/client.js";

test("resolveSettings: flag beats env beats default", () => {
  const prev = process.env.RANKGOAT_API_KEY;
  process.env.RANKGOAT_API_KEY = "env_key";
  try {
    assert.equal(resolveSettings({}).apiKey, "env_key");
    assert.equal(resolveSettings({ apiKey: "flag_key" }).apiKey, "flag_key");
  } finally {
    if (prev === undefined) delete process.env.RANKGOAT_API_KEY;
    else process.env.RANKGOAT_API_KEY = prev;
  }
});

test("resolveSettings: default base URL and trailing-slash strip", () => {
  assert.equal(resolveSettings({ apiKey: "k" }).apiUrl, DEFAULT_API_URL);
  assert.equal(resolveSettings({ apiKey: "k", apiUrl: "https://x.test/api/v1/" }).apiUrl, "https://x.test/api/v1");
});

test("makeClient: throws when no key is available", () => {
  const prev = process.env.RANKGOAT_API_KEY;
  const prevDir = process.env.RANKGOAT_CONFIG_DIR;
  delete process.env.RANKGOAT_API_KEY;
  // Point the config dir somewhere empty so a real ~/.rankgoat key can't leak in.
  process.env.RANKGOAT_CONFIG_DIR = "/nonexistent/rankgoat-test";
  try {
    assert.throws(() => makeClient({ apiUrl: "https://x.test/api/v1" }), (e) => e instanceof ApiError && e.code === "no_api_key");
  } finally {
    if (prev !== undefined) process.env.RANKGOAT_API_KEY = prev;
    if (prevDir === undefined) delete process.env.RANKGOAT_CONFIG_DIR;
    else process.env.RANKGOAT_CONFIG_DIR = prevDir;
  }
});

test("client: sends bearer auth and parses success body", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return new Response(JSON.stringify({ member: { id: 1, email: "a@b.c" }, sites: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const client = makeClient({ apiKey: "rg_test", apiUrl: "https://x.test/api/v1" });
    const data = await client.get("/me");
    assert.equal(data.member.email, "a@b.c");
    assert.equal(calls[0].url, "https://x.test/api/v1/me");
    assert.equal(calls[0].opts.headers.Authorization, "Bearer rg_test");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("client: maps error envelope to ApiError", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { code: "not_found", message: "Site not found." } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  try {
    const client = makeClient({ apiKey: "rg_test", apiUrl: "https://x.test/api/v1" });
    await assert.rejects(client.get("/sites/999"), (e) => e instanceof ApiError && e.status === 404 && e.code === "not_found");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("client: query params are appended, nullish skipped", async () => {
  let captured;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    captured = String(url);
    return new Response("{}", { status: 200 });
  };
  try {
    const client = makeClient({ apiKey: "k", apiUrl: "https://x.test/api/v1" });
    await client.get("/sites/1/plan", { query: { month: "2026-06", status: undefined } });
    assert.match(captured, /\/sites\/1\/plan\?month=2026-06$/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
