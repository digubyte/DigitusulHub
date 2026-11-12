import { requirePageUser } from "@/core/auth/session";
import { ExtensionSetup } from "@/modules/flyer-studio/components/extension-setup";

export const metadata = { title: "Extensão do Chrome" };

export default async function ExtensionPage() {
  await requirePageUser("flyers.access");
  return <ExtensionSetup />;
}
