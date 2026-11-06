import { requirePageUser } from "@/core/auth/session";
import { HttpError } from "@/core/http";
import { getStudioContext } from "@/modules/flyer-studio/services/studio-context";
import { getFlyer } from "@/modules/flyer-studio/services/flyer-service";
import { WizardClient } from "@/modules/flyer-studio/components/client-loaders";
import { ChatGptWizard } from "@/modules/flyer-studio/components/chatgpt-wizard";

export const metadata = { title: "Novo flyer" };

/** Padrão: flyers (ou lote) gerados no ChatGPT. `?modo=manual` abre a montagem no editor. */
export default async function NewFlyerPage({ searchParams }: { searchParams: Promise<{ template?: string; modo?: string }> }) {
  const user = await requirePageUser("flyers.create");
  const { template, modo } = await searchParams;
  const ctx = await getStudioContext(user);
  if (!template && modo !== "manual") return <ChatGptWizard ctx={ctx} />;
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
