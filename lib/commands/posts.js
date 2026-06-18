// rankgoat posts - generated posts for a site.
//   posts list <siteId> [--status draft|ready_to_publish|published|...]
//   posts get <postId> [--html]        full post (add --html to print the body)
//   posts approve <postId>             member-approve a drafted post for publishing
import { printJson, table, kv, status, dash, success, c } from "../output.js";
import { requireId } from "./sites.js";

export default async function run(args, ctx) {
  const client = ctx.getClient();
  const sub = args[0];

  if (sub === "list") {
    const id = requireId(args[1], "posts list <siteId> [--status <s>]");
    if (id == null) return;
    const data = await client.get(`/sites/${id}/posts`, { query: { status: ctx.flags.status } });
    if (ctx.json) return printJson(data);
    if (!data.posts.length) return console.log("No posts yet.");
    table(
      ["ID", "STATUS", "WORDS", "TITLE", "URL"],
      data.posts.map((p) => [p.id, status(p.status), dash(p.wordCount), p.title, dash(p.publishedUrl)]),
    );
    return;
  }

  if (sub === "get") {
    const id = requireId(args[1], "posts get <postId> [--html]");
    if (id == null) return;
    const p = await client.get(`/posts/${id}`);
    if (ctx.json) return printJson(p);
    kv([
      ["ID", p.id],
      ["Site", p.siteId],
      ["Status", status(p.status)],
      ["Title", c.bold(p.title)],
      ["Slug", dash(p.slug)],
      ["Words", dash(p.wordCount)],
      ["Language", dash(p.language)],
      ["Meta", dash(p.metaDescription)],
      ["Published URL", dash(p.publishedUrl)],
      ["Generated", dash(p.generatedAt)],
      ["Admin approved", dash(p.adminApprovedAt)],
      ["You approved", dash(p.memberApprovedAt)],
    ]);
    if (ctx.flags.html) {
      console.log();
      console.log(p.bodyHtml || c.gray("(no body)"));
    }
    return;
  }

  if (sub === "approve") {
    const id = requireId(args[1], "posts approve <postId>");
    if (id == null) return;
    const p = await client.post(`/posts/${id}/approve`, {});
    if (ctx.json) return printJson(p);
    success(`Post #${p.id} approved - now ${p.status}.`);
    return;
  }

  console.error(`Unknown posts command: ${sub}. Try: list, get, approve.`);
  process.exitCode = 1;
}
