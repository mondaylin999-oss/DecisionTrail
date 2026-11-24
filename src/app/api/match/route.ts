import { findMatches } from "@/lib/db/repo";
import { withUser } from "@/lib/http";
import { MatchRequestZ } from "@/lib/validation";

/** Deterministic retrieval over the caller's own decisions. No AI here. */
export async function POST(req: Request) {
  return withUser(req, async (caller) => {
    const input = MatchRequestZ.parse(await req.json());
    return Response.json(await findMatches(caller.uid, input));
  });
}
