import { stats } from "@/lib/db/repo";
import { withUser } from "@/lib/http";

export async function GET(req: Request) {
  return withUser(req, async (caller) => Response.json(await stats(caller.uid)));
}
