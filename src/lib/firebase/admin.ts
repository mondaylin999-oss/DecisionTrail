import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";

let app: App | undefined;

function adminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not set (FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY)");
  }
  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export class AuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
  }
}

export interface Caller {
  uid: string;
  email: string | null;
  name: string | null;
}

/**
 * Verifies the Firebase ID token (and optionally the App Check token).
 * The returned uid is the ONLY user id the server trusts.
 */
export async function verifyCaller(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AuthError("Missing ID token");

  if (process.env.APP_CHECK_ENFORCE_API === "true") {
    const ac = req.headers.get("x-firebase-appcheck");
    if (!ac) throw new AuthError("Missing App Check token", 401);
    try {
      await getAppCheck(adminApp()).verifyToken(ac);
    } catch {
      throw new AuthError("Invalid App Check token", 401);
    }
  }

  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? null, name: (decoded.name as string | undefined) ?? null };
  } catch {
    throw new AuthError("Invalid or expired ID token");
  }
}
