import { deleteWebReference } from "@/lib/db/repo";
import { notFound, withUser } from "@/lib/http";
import { WebReferenceDeleteZ } from "@/lib/validation";

// POST (not DELETE): the split-deployment CORS policy allows GET, POST, PATCH only.
export async function POST(req: Request) {
  return withUser(req, async (caller) => {
    const { id } = WebReferenceDeleteZ.parse(await req.json());
    return (await deleteWebReference(caller.uid, id)) ? Response.json({ deleted: true }) : notFound();
  });
}
