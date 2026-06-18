// rankgoat whoami — the authenticated member and a one-line summary per site.
import { printJson, table, heading, status, dash } from "../output.js";

export default async function run(args, ctx) {
  const client = ctx.getClient();
  const data = await client.get("/me");
  if (ctx.json) return printJson(data);

  heading(`${data.member.email}  (member #${data.member.id})`);
  console.log();
  if (!data.sites.length) {
    console.log("No sites yet. Add one at https://rankgoat.app/app/sites");
    return;
  }
  table(
    ["ID", "DOMAIN", "STATUS", "CREDITS", "ALLOTMENT"],
    data.sites.map((s) => [
      s.id,
      s.domain,
      status(s.status),
      dash(s.credits?.balance),
      dash(s.credits?.allotment),
    ]),
  );
}
