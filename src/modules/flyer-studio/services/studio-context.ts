import "server-only";
import type { CurrentUser } from "@/core/auth/session";
import { aiStatus } from "../ai/claude";
import { SITE_CATEGORIES } from "../catalog/categories";
import { getBrandKit, getPricingRule } from "./brand-service";
import type { StudioContext } from "../components/studio-types";

/** Tudo que as telas do Estúdio precisam saber do servidor (sem segredos). */
export async function getStudioContext(user: CurrentUser): Promise<StudioContext> {
  const [brandKit, pricingRule] = await Promise.all([getBrandKit(), getPricingRule()]);
  return {
    brandKit,
    pricingRule,
    aiEnabled: aiStatus().enabled,
    removeBgEnabled: !!process.env.REMOVE_BG_API_KEY,
    siteCategories: SITE_CATEGORIES,
    perms: {
      create: user.permissions.has("flyers.create"),
      ai: user.permissions.has("flyers.ai.use"),
      templates: user.permissions.has("flyers.templates.manage"),
      viewAll: user.permissions.has("flyers.view.all") || user.permissions.has("flyers.edit.any"),
    },
    userName: user.name,
  };
}
