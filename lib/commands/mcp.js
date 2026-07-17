// rankgoat mcp - run the Model Context Protocol server on stdio, so MCP
// clients (Claude Code, Cursor, custom agents) get every RankGoat capability
// as typed tools. Config example:
//   claude mcp add rankgoat -e RANKGOAT_API_KEY=rg_live_... -- npx -y rankgoat mcp
import { serveStdio } from "../mcp.js";

export default async function run(_args, ctx) {
  await serveStdio(ctx, ctx.version);
}
