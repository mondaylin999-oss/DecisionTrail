# DecisionTrail

**Learn From the Past. Decide With Confidence.**

DecisionTrail is a decision workspace. It structures a decision you're facing, retrieves what **you** and **documented others** did in similar situations and what actually happened, offers **consented live web research** when the evidence is thin, and then holds you to a **review date** so the outcome becomes your next lesson.

It never predicts outcomes and never picks an option for you.

Built for the Firebase #BuildHybridAI Hackathon 2026 with **Firebase AI Logic hybrid inference** (Gemini Nano on-device in Chrome + cloud Gemini).

> **Status: starter / MVP skeleton.** The full loop works (describe → structure → precedent → research → record → review). The case library ships with **80 research-draft cases** built from linked public sources; a human should verify each before relying on it (see [Curated cases](#curated-cases)).

---

## How the hybrid AI works

| Task | Where it runs | Inference mode | Why |
|---|---|---|---|
| Structure the decision (free text → JSON) | On-device in **Private** mode; on-device first in **Hybrid** | `ONLY_ON_DEVICE` / `PREFER_ON_DEVICE` | Private text stays on the device by default |
| Generalize a private decision into a research query | **Always on-device** | `ONLY_ON_DEVICE` | The input *is* the private text, so cloud fallback would defeat the purpose |
| Live research with Grounding with Google Search | Cloud only, after consent | `ONLY_IN_CLOUD` | Tools and grounding aren't supported on-device |
| Retrieval and matching | Our server, deterministic SQL + rules | — (no AI) | Explainable, and AI can't invent cases |

Every AI result shows a **🔒 ON_DEVICE** or **☁️ IN_CLOUD** badge read from the SDK's `response.inferenceSource`, never assumed.

**Why there's a router.** In `PREFER_ON_DEVICE` mode the SDK silently sends a request to the cloud when the on-device model is unavailable. So no cloud-capable model is ever built unless the user's privacy mode allows it. All routing lives in [`src/lib/ai/router.ts`](src/lib/ai/router.ts), with unit tests proving that Private mode can't reach the cloud.

### Privacy modes
- **Private** (default): on-device only. If Gemini Nano is unavailable, the user fills in forms manually.
- **Hybrid**: on-device first; cloud fallback for structuring is allowed and disclosed.
- **Cloud Research**: Hybrid plus live research. Each research request needs explicit consent for the exact query.

Privacy modes govern where AI **processing** happens. Saved decisions are stored in PostgreSQL so users can access them later.

### How consent is enforced
1. Gemini Nano generalizes the query on-device, then a deterministic leak check ([`redact.ts`](src/lib/ai/redact.ts)) flags names, amounts, emails and other details that survived.
2. The user edits the query and sees what will and won't be sent, who processes it, and whether results are saved.
3. `POST /api/consent` stores a consent record with the SHA-256 of the exact payload and returns its ID.
4. The router only builds an `ONLY_IN_CLOUD` research model when a consent ID exists *and* the mode is Cloud Research.
5. `POST /api/research` saves results only if the payload hash matches an unexpired (15 min) consent owned by the caller.

**Honest limitation:** Firebase AI Logic calls go from the browser, so the server can't stop a *modified* client from calling Gemini directly. Consent protects honest users from accidental transmission. App Check plus Firebase Auth limit abuse.

---

## Tech stack
Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Firebase Auth · Firebase App Check (reCAPTCHA Enterprise) · Firebase AI Logic (`firebase/ai`) · PostgreSQL · Drizzle ORM · Zod · Vitest

```
src/
  lib/ai/          router.ts (where tasks may run) · tasks.ts (every AI call) · schemas.ts · redact.ts · availability.ts
  lib/matching/    score.ts: deterministic matching and labels (spec J)
  lib/db/          schema.ts (Drizzle) · repo.ts (owner-scoped queries) · client.ts
  lib/firebase/    client.ts (browser) · admin.ts (ID token + App Check verification)
  app/api/         route handlers: every one verifies the Firebase ID token
  app/             dashboard, decisions/new (core workspace), decisions/[id] (record + review), explorer, research, settings
scripts/           seed-cases.ts (verified cases) · seed-demo.ts (labelled demo data)
data/cases/        _TEMPLATE.json: add verified case files here
```

---

## Setup

### 0. Requirements
- Node.js 22+
- A PostgreSQL database (Neon or Supabase free tier works; or local Postgres)
- A Firebase project
- **For on-device AI:** desktop Chrome 139+ on Windows 10/11, macOS 13+, Linux or Chromebook Plus; at least 22 GB free disk; a GPU with more than 4 GB VRAM, or 16 GB RAM with 4+ CPU cores. Check `chrome://on-device-internals`. If Chrome docs or the Firebase guide ask for flags (e.g. `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`), enable them and restart Chrome.

### 1. Firebase console
1. **Authentication → Sign-in method:** enable **Google**. Add your hosting domain under *Authorized domains*.
2. **AI Logic:** click *Get started*, choose the **Gemini Developer API**. App Check enforcement for AI Logic is mandatory since 2 Nov 2026.
3. **App Check:** create a **reCAPTCHA Enterprise** website key (score-based, no checkbox) for your domains, register the web app with it, and enforce App Check for Firebase AI Logic. For localhost, register a **debug token**.
4. Recommended: enable **authenticated-users mode** for AI Logic (every user signs in anyway). **Do not** enable template-only mode, because hybrid inference doesn't support server prompt templates.
5. **Project settings → Service accounts:** generate a private key for the Admin SDK.

### 2. Configure and run
```bash
npm install
cp .env.example .env.local      # fill in every value
npm run db:push                 # create tables
npm run dev                     # http://localhost:3000
```

### 3. Optional demo data
Sign in once, then:
```bash
npm run db:seed-demo -- --email you@example.com          # 3 records labelled DEMO DATA
npm run db:seed-demo -- --email you@example.com --reset  # replace them
```
One demo record is overdue for review, so you can show the review wizard immediately.

### Checks
```bash
npm test          # router, matching and redaction unit tests
npm run typecheck
npm run lint
npm run build
```

---

## Curated cases
The external library is the product's credibility. `data/cases/` holds 80 research-draft cases (marked "pending human review"), each built from linked public sources, mostly secondary news coverage. Verify them against primary sources before treating them as authoritative. Nothing in the library may come from AI memory.

1. Copy `data/cases/_TEMPLATE.json` to `data/cases/<slug>.json`.
2. Fill every field from real sources, **in your own words** (no copied articles). Link each claim to at least one source. State the limitations.
3. Run `npm run db:seed-cases`. The script rejects files with placeholders, claims without sources, or a known outcome without an outcome claim. It reports the share of negative, mixed and reversed cases (target ≥ 40%, to avoid survivorship bias).

Candidate cases worth verifying are listed in the discovery pack (deliverable G).

---

## Deploying

The app can run as one Next.js service, or split across Vercel and Render:

1. Create a Neon Postgres project and set `DATABASE_URL` on the server.
2. Deploy the repository to Render using [`render.yaml`](render.yaml). Set `FRONTEND_ORIGIN` to the Vercel production origin, without a trailing slash.
3. Import the same repository into Vercel. Set `NEXT_PUBLIC_API_BASE_URL` to the Render service URL, without a trailing slash.
4. Set the Firebase client settings (`NEXT_PUBLIC_FIREBASE_*` and `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`) in Vercel. Set `FIREBASE_PROJECT_ID` in Render. ID and App Check token verification uses Google's public signing keys, so no service-account key is needed.
5. Add the Vercel production domain to Firebase Auth *Authorized domains* and to the reCAPTCHA Enterprise key. Set `APP_CHECK_ENFORCE_API=true` on Render after the API App Check verification is configured.
6. Run `npm run db:push` against the Neon database once to create the tables.

For a single-origin deployment, leave `NEXT_PUBLIC_API_BASE_URL` and `FRONTEND_ORIGIN` empty.

## Known gaps (next steps)
- Email review reminders (in-app only for now)
- Data export and account deletion endpoints
- PostgreSQL Row-Level Security (app-level owner checks are in place; RLS would add a second layer)
- AI-phrased similarity summaries; classifying research findings into precedent / research / opinion
- Promoting research candidates into the curated library (editor workflow)

## Disclaimer
DecisionTrail is not a substitute for qualified medical, legal or financial professionals. Historical similarity does not predict future outcomes.

## License
MIT. See [LICENSE](LICENSE).
