import { requirePageUser } from "@/core/auth/session";
import { HttpError } from "@/core/http";
import { getStudioContext } from "@/modules/flyer-studio/services/studio-context";
import { getFlyer } from "@/modules/flyer-studio/services/flyer-service";
import { WizardClient } from "@/modules/flyer-studio/components/client-loaders";
import { redirect } from "next/navigation";

export const metadata = { title: "Novo flyer" };

/** A criação acontece em /criar. Aqui fica só a montagem manual no editor (`?modo=manual`) e templates antigos. */
export default async function NewFlyerPage({ searchParams }: { searchParams: Promise<{ template?: string; modo?: string }> }) {
  const user = await requirePageUser("flyers.create");
  const { template, modo } = await searchParams;
  if (!template && modo !== "manual") redirect("/criar");
  const ctx = await getStudioContext(user);
  let tpl = null;
  if (template) {
    try {
      const f = await getFlyer(user, template);
      tpl = { layout: f.layoutConfig, formatKey: f.formatKey, width: f.width, height: f.height, campaign: f.campaign, name: f.name };
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
    }
  }
  return <WizardClient ctx={ctx} template={tpl} />;
}
