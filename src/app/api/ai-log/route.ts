import { logAi } from "@/lib/db/repo";
import { withUser } from "@/lib/http";
import { AiLogZ } from "@/lib/validation";

/** Text-free AI processing log: task, where it ran, success, latency. Never prompts or outputs. */
export async function POST(req: Request) {
  return withUser(req, async (caller) => {
    const e = AiLogZ.parse(await req.json());
    await logAi(caller.uid, e);
    return Response.json({ ok: true });
  });
}
