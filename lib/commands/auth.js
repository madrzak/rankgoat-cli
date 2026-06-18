// rankgoat auth - manage the stored API key (~/.rankgoat/config.json).
//   auth login [key]   save a key (prompts/reads stdin if omitted)
//   auth status        show where the key + base URL resolve from, and verify it
//   auth logout        remove the stored key
import { writeConfig, readConfig, resolveSettings, configPath } from "../config.js";
import { makeClient } from "../client.js";
import { printJson, kv, success, note, c } from "../output.js";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.trim()));
  });
}

export default async function run(args, ctx) {
  const sub = args[0];

  if (sub === "login") {
    let key = args[1];
    if (!key && !process.stdin.isTTY) key = await readStdin();
    if (!key) {
      console.error('Usage: rankgoat auth login <key>   (create one at https://rankgoat.app/app/settings#api)');
      process.exitCode = 1;
      return;
    }
    writeConfig({ apiKey: key, ...(ctx.flags.apiUrl ? { apiUrl: ctx.flags.apiUrl } : {}) });
    // Verify the key works before declaring success.
    try {
      const me = await makeClient({ apiKey: key, apiUrl: ctx.flags.apiUrl }).get("/me");
      success(`Signed in as ${c.bold(me.member.email)}. Key saved to ${configPath()}`);
    } catch (err) {
      note(`Key saved to ${configPath()}, but verification failed: ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  if (sub === "logout") {
    writeConfig({ apiKey: null });
    success("Removed stored API key.");
    return;
  }

  if (sub === "status" || sub === undefined) {
    const cfg = readConfig();
    const { apiKey, apiUrl } = resolveSettings(ctx.flags);
    const source = ctx.flags.apiKey
      ? "--api-key flag"
      : process.env.RANKGOAT_API_KEY
        ? "RANKGOAT_API_KEY env"
        : cfg.apiKey
          ? configPath()
          : "(none)";
    if (ctx.json) return printJson({ apiUrl, keySource: source, hasKey: !!apiKey });
    kv([
      ["Base URL", apiUrl],
      ["Key source", source],
      ["Key", apiKey ? c.gray(apiKey.slice(0, 12) + "…") : c.red("not set")],
    ]);
    if (apiKey) {
      try {
        const me = await makeClient(ctx.flags).get("/me");
        success(`Authenticated as ${me.member.email}`);
      } catch (err) {
        console.log(`${c.red("✗")} ${err.message}`);
        process.exitCode = 1;
      }
    }
    return;
  }

  console.error(`Unknown auth command: ${sub}. Try: login, status, logout.`);
  process.exitCode = 1;
}
