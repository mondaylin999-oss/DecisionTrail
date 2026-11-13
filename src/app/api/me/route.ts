import { setPrivacyMode } from "@/lib/db/repo";
import { withUser } from "@/lib/http";
import { PrivacyModeZ } from "@/lib/validation";

export async function GET(req: Request) {
  return withUser(req, async (_c, user) =>
    Response.json({ id: user.id, email: user.email, displayName: user.displayName, privacyMode: user.privacyMode }),
  );
}

export async function PATCH(req: Request) {
  return withUser(req, async (caller) => {
    const { privacy_mode } = PrivacyModeZ.parse(await req.json());
    await setPrivacyMode(caller.uid, privacy_mode);
    return Response.json({ privacyMode: privacy_mode });
  });
}
