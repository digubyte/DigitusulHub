import { z } from "zod";
import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { logActivity } from "@/core/audit";
import { getBrandKit } from "@/modules/flyer-studio/services/brand-service";
import { EDITOR_FONTS } from "@/modules/flyer-studio/domain/brand";

export const GET = apiRoute({ permission: "flyers.access" }, async () => jsonOk(await getBrandKit()));

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato #RRGGBB");
const font = z.enum(EDITOR_FONTS as [string, ...string[]]);
const Body = z.object({
  colors: z.array(z.object({ key: z.string().max(30), name: z.string().trim().min(1).max(40), hex, usage: z.string().max(120) })).min(1).max(12),
  fonts: z.object({ heading: font, body: font, price: font }),
  rules: z.string().max(4000),
  approvedPhrases: z.array(z.object({ category: z.string().max(30), text: z.string().trim().min(1).max(120) })).max(100),
  logoFileId: z.string().nullable(),
  logoOnDarkFileId: z.string().nullable(),
});

export const PUT = apiRoute({ permission: "brandkit.manage" }, async ({ req, user }) => {
  const d = await parseBody(req, Body);
  for (const id of [d.logoFileId, d.logoOnDarkFileId]) {
    if (id && !(await db.storedFile.findFirst({ where: { id, purpose: "brand" } }))) throw new HttpError(422, "Arquivo de logotipo inválido. Envie-o novamente.");
  }
  const data = {
    colors: JSON.stringify(d.colors), fonts: JSON.stringify(d.fonts), rules: d.rules, approvedPhrases: JSON.stringify(d.approvedPhrases),
    logoFileId: d.logoFileId, logoOnDarkFileId: d.logoOnDarkFileId, updatedById: user.id,
  };
  await db.brandKit.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  await logActivity(user.id, "brandkit.update");
  return jsonOk(await getBrandKit());
});
