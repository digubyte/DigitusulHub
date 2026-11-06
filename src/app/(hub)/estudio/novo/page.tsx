import { requirePageUser } from "@/core/auth/session";
import { HttpError } from "@/core/http";
import { getStudioContext } from "@/modules/flyer-studio/services/studio-context";
import { getFlyer } from "@/modules/flyer-studio/services/flyer-service";
import { WizardClient } from "@/modules/flyer-studio/components/client-loaders";

export const metadata = { title: "Novo flyer" };

export default async function NewFlyerPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const user = await requirePageUser("flyers.create");
  const { template } = await searchParams;
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
