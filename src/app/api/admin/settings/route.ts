import { z } from "zod";
import { db } from "@/core/db";
import { apiRoute, jsonOk, parseBody } from "@/core/http";
import { logActivity } from "@/core/audit";

const Pricing = z.object({ markupEnabled: z.boolean(), markupBps: z.number().int().min(0).max(10000), rounding: z.enum(["psychological", "cents"]) });

/** Regra de preço do Estúdio (valor no cartão → valor final). */
export const PUT = apiRoute({ permission: "integrations.manage" }, async ({ req, user }) => {
  const rule = await parseBody(req, Pricing);
  await db.setting.upsert({ where: { key: "flyers.pricingRule" }, update: { value: JSON.stringify(rule) }, create: { key: "flyers.pricingRule", value: JSON.stringify(rule) } });
  await logActivity(user.id, "module.update", { type: "setting", id: "flyers.pricingRule" }, rule);
  return jsonOk({ ok: true });
});
