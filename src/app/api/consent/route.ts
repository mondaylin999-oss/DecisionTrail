import { createConsent } from "@/lib/db/repo";
import { withUser } from "@/lib/http";
import { ConsentZ } from "@/lib/validation";

/**
 * Records explicit consent for ONE research payload and returns its id.
 * The client may only build a cloud research model once it holds this id
 * (see lib/ai/router.ts), and results are only saved if the payload hash matches.
 */
export async function POST(req: Request) {
  return withUser(req, async (caller, user) => {
    if (user.privacyMode !== "cloud_research") {
      return Response.json({ error: "Switch to Cloud Research mode in Settings first." }, { status: 403 });
    }
    const body = ConsentZ.parse(await req.json());
    const row = await createConsent(caller.uid, {
      purpose: body.purpose,
      payloadText: body.payload_text,
      keepCopy: body.keep_copy,
      saveResults: body.save_results,
      model: body.model,
    });
    return Response.json({ consentId: row.id, grantedAt: row.grantedAt }, { status: 201 });
  });
}
