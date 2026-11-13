import { getDecision } from "@/lib/db/repo";
import { notFound, withUser } from "@/lib/http";
import { z } from "zod";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(req, async (caller) => {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return notFound();
    const d = await getDecision(caller.uid, id);
    return d ? Response.json(d) : notFound();
  });
}
