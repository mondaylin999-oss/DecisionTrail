import { createDecision, listDecisions } from "@/lib/db/repo";
import { withUser } from "@/lib/http";
import { CreateDecisionZ } from "@/lib/validation";

export async function GET(req: Request) {
  return withUser(req, async (caller) => Response.json({ decisions: await listDecisions(caller.uid) }));
}

export async function POST(req: Request) {
  return withUser(req, async (caller) => {
    const input = CreateDecisionZ.parse(await req.json());
    const id = await createDecision(caller.uid, input);
    return Response.json({ id }, { status: 201 });
  });
}
