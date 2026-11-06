import { z } from "zod";
import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { CORE_MODULES, MODULES } from "@/core/modules/registry";
import { logActivity } from "@/core/audit";

const Body = z.object({
  modules: z.array(z.object({
    key: z.string(), name: z.string().trim().min(2).max(60), status: z.enum(["active", "development", "disabled"]),
    order: z.number().int().min(0).max(1000), visible: z.boolean(),
  })),
});

export const PUT = apiRoute({ permission: "modules.manage" }, async ({ req, user }) => {
  const { modules } = await parseBody(req, Body);
  for (const m of modules) {
    const manifest = MODULES.find((x) => x.key === m.key);
    if (!manifest) throw new HttpError(422, `Módulo desconhecido: ${m.key}`);
    if (CORE_MODULES.has(m.key) && (m.status !== "active" || !m.visible)) throw new HttpError(422, `O módulo "${manifest.name}" faz parte do núcleo e não pode ser desativado.`);
    // Só pode ficar "ativo" o módulo que já tem implementação (rota própria).
    if (m.status === "active" && manifest.route.startsWith("/modulos/")) throw new HttpError(422, `"${manifest.name}" ainda não possui implementação e não pode ser ativado.`);
  }
  await db.$transaction(modules.map((m) => db.module.upsert({ where: { key: m.key }, update: { name: m.name, status: m.status, order: m.order, visible: m.visible }, create: m })));
  await logActivity(user.id, "module.update", null, { count: modules.length });
  return jsonOk({ ok: true });
});
