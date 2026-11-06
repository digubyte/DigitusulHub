import { redirect } from "next/navigation";
import { requirePageUser } from "@/core/auth/session";

export default async function AdminIndex() {
  const u = await requirePageUser();
  const p = u.permissions;
  redirect(p.has("users.manage") ? "/admin/usuarios" : p.has("brandkit.manage") ? "/admin/brand-kit" : p.has("modules.manage") ? "/admin/modulos" : p.has("integrations.manage") ? "/admin/integracoes" : "/admin/auditoria");
}
