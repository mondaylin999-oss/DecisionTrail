import { reviewDecision } from "@/lib/db/repo";
import { notFound, withUser } from "@/lib/http";
import { ReviewZ } from "@/lib/validation";
import { z } from "zod";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(req, async (caller) => {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return notFound();
    const input = ReviewZ.parse(await req.json());
    const reviewId = await reviewDecision(caller.uid, id, input);
    return reviewId ? Response.json({ reviewId }, { status: 201 }) : notFound();
  });
}
