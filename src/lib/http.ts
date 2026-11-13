import "server-only";
import { connection } from "next/server";
import { ZodError } from "zod";
import { AuthError, verifyCaller, type Caller } from "./firebase/admin";
import { ensureUser } from "./db/repo";

type User = Awaited<ReturnType<typeof ensureUser>>;

/**
 * Wraps a route handler: verifies the caller, makes sure the user row
 * exists, and maps errors to JSON responses without leaking internals.
 */
export async function withUser(
  req: Request,
  fn: (caller: Caller, user: User) => Promise<Response>,
): Promise<Response> {
  // Per-user data: always render at request time, never prerender or cache.
  await connection();
  try {
    const caller = await verifyCaller(req);
    const user = await ensureUser(caller.uid, caller.email, caller.name);
    return await fn(caller, user);
  } catch (e) {
    // Let Next.js internal control-flow errors (they carry a `digest`) propagate.
    if (e && typeof e === "object" && "digest" in e) throw e;
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError) {
      return Response.json({ error: "Invalid request", issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
    }
    console.error("[api]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

export const notFound = () => Response.json({ error: "Not found" }, { status: 404 });
