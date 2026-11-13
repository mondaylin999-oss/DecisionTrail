import { checkConsent, listResearch, saveResearch } from "@/lib/db/repo";
import { withUser } from "@/lib/http";
import { ResearchSaveZ } from "@/lib/validation";

export async function GET(req: Request) {
  return withUser(req, async (caller) => Response.json({ sessions: await listResearch(caller.uid) }));
}

/** Saves a grounded research session, but only for a valid, matching, unexpired consent. */
export async function POST(req: Request) {
  return withUser(req, async (caller) => {
    const body = ResearchSaveZ.parse(await req.json());
    const check = await checkConsent(caller.uid, body.consent_id, body.payload_text);
    if (!check.ok) return Response.json({ error: check.reason }, { status: 403 });
    if (!check.consent.resultsSaved) return Response.json({ saved: false });
    const id = await saveResearch(caller.uid, {
      consentId: body.consent_id,
      payloadText: body.payload_text,
      decisionId: body.decision_id,
      resultText: body.result_text,
      webSearchQueries: body.web_search_queries,
      searchEntryPointHtml: body.search_entry_point_html,
      sources: body.sources,
      findings: body.findings,
    });
    return Response.json({ saved: true, id }, { status: 201 });
  });
}
