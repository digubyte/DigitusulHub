import { notFound } from "next/navigation";
import { requirePageUser } from "@/core/auth/session";
import { getStudioContext } from "@/modules/flyer-studio/services/studio-context";
import { getFlyer, listFlyers } from "@/modules/flyer-studio/services/flyer-service";
import { ChatGptBatchView } from "@/modules/flyer-studio/components/chatgpt-views";

export const metadata = { title: "Lote de flyers" };

export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const user = await requirePageUser("flyers.access");
  const { batchId } = await params;
  const rows = await listFlyers(user, { batchId, scope: "all" });
  if (!rows.length) notFound();
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  const flyers = await Promise.all(sorted.map((r) => getFlyer(user, r.id)));
  const ctx = await getStudioContext(user);
  return (
    <ChatGptBatchView
      ctx={ctx}
      campaign={flyers[0].campaign}
      batchId={batchId}
      flyers={flyers.map((f) => ({ id: f.id, name: f.name, products: f.products, prompt: f.prompt ?? "", resultFileId: f.resultFileId, width: f.width, height: f.height, formatKey: f.formatKey, canEdit: f.canEdit, layout: f.layoutConfig, chatUrl: f.chatUrl, reviewStatus: f.reviewStatus, reviewNote: f.reviewNote }))}
    />
  );
}
