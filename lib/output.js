// Zero-dependency terminal formatting: ANSI colors (auto-off when piped or
// NO_COLOR is set), a column-aligned table, and key/value blocks. Every command
// renders through here so --json (raw) and human output stay consistent.

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  bold: wrap(1),
  dim: wrap(2),
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  blue: wrap(34),
  magenta: wrap(35),
  cyan: wrap(36),
  gray: wrap(90),
};

const ANSI = /\x1b\[[0-9;]*m/g;
const visibleLen = (s) => String(s).replace(ANSI, "").length;
const padEnd = (s, w) => String(s) + " ".repeat(Math.max(0, w - visibleLen(s)));

export function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

// headers: string[]; rows: (string|number)[][]. Cells may contain ANSI codes;
// width is computed on the visible length so columns still line up.
export function table(headers, rows) {
  if (!rows.length) return;
  const widths = headers.map((h, i) =>
    Math.max(visibleLen(h), ...rows.map((r) => visibleLen(r[i] ?? ""))),
  );
  const fmt = (cells) => cells.map((cell, i) => padEnd(cell ?? "", widths[i])).join("  ").trimEnd();
  console.log(c.bold(fmt(headers)));
  for (const r of rows) console.log(fmt(r));
}

// pairs: [label, value][]. Right-pads labels so values align.
export function kv(pairs) {
  const w = Math.max(...pairs.map(([k]) => k.length));
  for (const [k, v] of pairs) {
    console.log(`${c.gray(padEnd(k + ":", w + 1))} ${v ?? ""}`);
  }
}

export function heading(text) {
  console.log(c.bold(text));
}

export function note(text) {
  console.log(c.gray(text));
}

export function success(text) {
  console.log(`${c.green("✓")} ${text}`);
}

const STATUS_COLORS = {
  active: c.green,
  approved: c.green,
  live: c.green,
  done: c.green,
  ready_to_publish: c.green,
  published: c.green,
  planned: c.cyan,
  scanning: c.cyan,
  running: c.cyan,
  pending_approval: c.yellow,
  draft: c.yellow,
  paused: c.yellow,
  skipped: c.gray,
  removed: c.red,
  error: c.red,
  lost: c.red,
};

export function status(s) {
  if (s == null) return "";
  const paint = STATUS_COLORS[s] || ((x) => x);
  return paint(String(s));
}

export function dash(v) {
  return v == null || v === "" ? c.gray("-") : String(v);
}
