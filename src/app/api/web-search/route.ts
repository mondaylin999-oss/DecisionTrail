import { withUser } from "@/lib/http";
import { WebSearchQueryZ } from "@/lib/validation";
import { parseSearch, searchApiUrl } from "@/lib/web/wikipedia";

/**
 * Live online lookup. Only the words the user typed are sent, to Wikipedia's
 * public search API, with a generic User-Agent. No AI is involved, so results
 * are real pages with links, never generated text.
 */
export async function GET(req: Request) {
  return withUser(req, async () => {
    const q = WebSearchQueryZ.parse(new URL(req.url).searchParams.get("q") ?? "");
    let res: Response;
    try {
      res = await fetch(searchApiUrl(q), {
        headers: { "User-Agent": "DecisionTrail/0.1 (decision research lookup)", Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
    } catch {
      return Response.json({ error: "Online search is unavailable right now. Try again in a moment." }, { status: 502 });
    }
    if (!res.ok) return Response.json({ error: "Online search is unavailable right now. Try again in a moment." }, { status: 502 });
    return Response.json({ results: parseSearch(await res.json().catch(() => null)) });
  });
}
