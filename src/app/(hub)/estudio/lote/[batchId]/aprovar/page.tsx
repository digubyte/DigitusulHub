import { notFound } from "next/navigation";
import { requirePageUser } from "@/core/auth/session";
import { getFlyer, listFlyers } from "@/modules/flyer-studio/services/flyer-service";
import { ApprovalSlides } from "@/modules/flyer-studio/components/approval-slides";

export const metadata = { title: "Aprovar flyers" };

export default async function ApprovePage({ params }: { params: Promise<{ batchId: string }> }) {
  const user = await requirePageUser("flyers.access");
  const { batchId } = await params;
  const rows = await listFlyers(user, { batchId, scope: "all" });
  if (!rows.length) notFound();
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  const flyers = await Promise.all(sorted.map((r) => getFlyer(user, r.id)));
  return (
    <ApprovalSlides
      batchId={batchId}
      title={flyers[0].name.replace(/ · \d+\/\d+$/, "")}
      flyers={flyers.map((f) => ({ id: f.id, name: f.name, products: f.products, resultFileId: f.resultFileId, reviewStatus: f.reviewStatus, reviewNote: f.reviewNote, canEdit: f.canEdit }))}
    />
  );
}
