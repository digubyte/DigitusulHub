import { requirePageUser } from "@/core/auth/session";
import { getStudioContext } from "@/modules/flyer-studio/services/studio-context";
import { BatchDay } from "@/modules/flyer-studio/components/batch-day";

export const metadata = { title: "Lote do dia" };

export default async function BatchDayPage() {
  const user = await requirePageUser("flyers.create");
  return <BatchDay ctx={await getStudioContext(user)} />;
}
