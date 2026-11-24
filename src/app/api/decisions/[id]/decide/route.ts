import { decideDraft } from "@/lib/db/repo";
import { notFound, withUser } from "@/lib/http";
import { DecideZ } from "@/lib/validation";
import { z } from "zod";

/** Finalises a draft: records the choice and schedules its review. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(req, async (caller) => {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return notFound();
    const input = DecideZ.parse(await req.json());
    return (await decideDraft(caller.uid, id, input)) ? Response.json({ decided: true }) : notFound();
  });
}
