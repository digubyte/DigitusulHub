import { requirePageUser } from "@/core/auth/session";
import { getStudioContext } from "@/modules/flyer-studio/services/studio-context";
import { campaigns } from "@/modules/flyer-studio/services/flyer-service";
import { StudioHome } from "@/modules/flyer-studio/components/studio-home";

export const metadata = { title: "Histórico" };

export default async function StudioPage() {
  const user = await requirePageUser("flyers.access");
  const [ctx, camps] = await Promise.all([getStudioContext(user), campaigns(user)]);
  return <StudioHome ctx={ctx} campaigns={camps} />;
}
