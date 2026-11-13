import { listConsents } from "@/lib/db/repo";
import { withUser } from "@/lib/http";

export async function GET(req: Request) {
  return withUser(req, async (caller) => Response.json({ consents: await listConsents(caller.uid) }));
}
