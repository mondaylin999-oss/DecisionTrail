import { listWebReferences, saveWebReference } from "@/lib/db/repo";
import { withUser } from "@/lib/http";
import { WebReferenceZ } from "@/lib/validation";

export async function GET(req: Request) {
  return withUser(req, async (caller) => Response.json({ references: await listWebReferences(caller.uid) }));
}

/** Saves one search result for the caller only. It stays personal and unverified. */
export async function POST(req: Request) {
  return withUser(req, async (caller) => {
    const body = WebReferenceZ.parse(await req.json());
    const id = await saveWebReference(caller.uid, body);
    return Response.json({ saved: id !== null, id }, { status: id ? 201 : 200 });
  });
}
