import { jsonOk } from "@/core/http";
import { destroySession, getCurrentUser } from "@/core/auth/session";
import { logActivity } from "@/core/audit";

export async function POST() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await logActivity(user.id, "auth.logout");
  return jsonOk({ ok: true });
}
