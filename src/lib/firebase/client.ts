"use client";
/**
 * Browser-only Firebase setup: App, Auth, App Check and Firebase AI Logic.
 * Everything is created lazily so nothing runs during server rendering.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken,
  type AppCheck,
} from "firebase/app-check";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let appCheck: AppCheck | undefined;
let ai: AI | undefined;

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

export function firebaseApp(): FirebaseApp {
  if (typeof window === "undefined") throw new Error("Firebase client used on the server");
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Copy .env.example to .env.local and fill it in.");
  }
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(config);
  initAppCheck(app);
  return app;
}

function initAppCheck(a: FirebaseApp) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  // Debug provider ONLY on localhost. Register the printed debug token in
  // Firebase console → App Check → Manage debug tokens.
  if (isLocalhost) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }
  if (!siteKey) {
    console.warn("[DecisionTrail] NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY is missing; App Check is not initialised.");
    return;
  }
  appCheck = initializeAppCheck(a, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

export function firebaseAI(): AI {
  if (ai) return ai;
  ai = getAI(firebaseApp(), {
    backend: new GoogleAIBackend(),
    // Each AI request gets a fresh, single-use App Check token (replay protection).
    useLimitedUseAppCheckTokens: true,
  });
  return ai;
}

/** App Check token for our own API routes (optional server verification). */
const APP_CHECK_TIMEOUT_MS = 4000;

export async function appCheckHeader(): Promise<Record<string, string>> {
  if (!appCheck) return {};
  const check = appCheck;
  try {
    // reCAPTCHA can hang forever (for example when the site key does not allow
    // this domain). Give up after a few seconds so API calls still go out.
    const { token } = await Promise.race([
      getAppCheckToken(check, false),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("App Check timed out")), APP_CHECK_TIMEOUT_MS)),
    ]);
    return { "X-Firebase-AppCheck": token };
  } catch {
    return {};
  }
}

export const CLOUD_MODEL = process.env.NEXT_PUBLIC_GEMINI_CLOUD_MODEL || "gemini-3.5-flash-lite";
export const RESEARCH_MODEL = process.env.NEXT_PUBLIC_GEMINI_RESEARCH_MODEL || CLOUD_MODEL;
