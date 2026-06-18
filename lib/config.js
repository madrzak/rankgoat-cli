// Resolves where the CLI gets its API key and base URL from, in priority order:
// explicit flag > environment variable > ~/.rankgoat/config.json > built-in default.
// The config file is the only state the CLI persists, and only `auth` writes it.

import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_API_URL = "https://rankgoat.app/api/v1";

const CONFIG_DIR = join(homedir(), ".rankgoat");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function configPath() {
  return CONFIG_FILE;
}

export function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

// Merge a patch into the stored config and write it back with owner-only perms,
// since it holds the API key.
export function writeConfig(patch) {
  const cfg = { ...readConfig(), ...patch };
  for (const k of Object.keys(cfg)) if (cfg[k] == null) delete cfg[k];
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n");
  try {
    chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // best-effort on platforms without POSIX perms
  }
  return cfg;
}

export function resolveSettings(flags = {}) {
  const cfg = readConfig();
  const apiKey = flags.apiKey || process.env.RANKGOAT_API_KEY || cfg.apiKey || null;
  const apiUrl = (flags.apiUrl || process.env.RANKGOAT_API_URL || cfg.apiUrl || DEFAULT_API_URL).replace(/\/+$/, "");
  return { apiKey, apiUrl };
}
