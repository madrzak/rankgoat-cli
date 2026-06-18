// Thin fetch wrapper around the RankGoat JSON API. Speaks the same envelope the
// server uses: success bodies are returned as-is, error bodies
// ({ error: { code, message } }) become a thrown ApiError the CLI can format.

import { resolveSettings } from "./config.js";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function makeClient(flags = {}) {
  const { apiKey, apiUrl } = resolveSettings(flags);
  if (!apiKey) {
    throw new ApiError(
      0,
      "no_api_key",
      'No API key found. Run "rankgoat auth login <key>", set RANKGOAT_API_KEY, or pass --api-key.',
    );
  }

  async function request(method, path, { query, body } = {}) {
    const url = new URL(apiUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v != null && v !== "") url.searchParams.set(k, String(v));
      }
    }
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new ApiError(0, "network_error", `Could not reach ${url.host}: ${err.message}`);
    }

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const err = (data && data.error) || {};
      throw new ApiError(res.status, err.code || "http_error", err.message || `HTTP ${res.status}`);
    }
    return data;
  }

  return {
    apiUrl,
    get: (p, opts) => request("GET", p, opts),
    post: (p, opts) => request("POST", p, opts),
    patch: (p, opts) => request("PATCH", p, opts),
  };
}
