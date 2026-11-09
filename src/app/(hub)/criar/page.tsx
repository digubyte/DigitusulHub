import { requirePageUser } from "@/core/auth/session";
import { getStudioContext } from "@/modules/flyer-studio/services/studio-context";
import { CreateFlyers } from "@/modules/flyer-studio/components/create-flyers";

export const metadata = { title: "Criar flyers" };

export default async function CreatePage() {
  const user = await requirePageUser("flyers.create");
  return <CreateFlyers ctx={await getStudioContext(user)} />;
}
