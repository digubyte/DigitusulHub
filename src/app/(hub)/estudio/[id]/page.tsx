import { notFound } from "next/navigation";
import { requirePageUser } from "@/core/auth/session";
import { HttpError } from "@/core/http";
import { getStudioContext } from "@/modules/flyer-studio/services/studio-context";
import { getFlyer } from "@/modules/flyer-studio/services/flyer-service";
import { EditorClient } from "@/modules/flyer-studio/components/client-loaders";
import { ChatGptProjectView } from "@/modules/flyer-studio/components/chatgpt-views";

export const metadata = { title: "Flyer" };

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("flyers.access");
  const { id } = await params;
  let f;
  try {
    f = await getFlyer(user, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const ctx = await getStudioContext(user);
  if (f.mode === "chatgpt") {
    return (
      <ChatGptProjectView
        ctx={ctx}
        batchId={f.batchId}
        flyer={{ id: f.id, name: f.name, products: f.products, prompt: f.prompt ?? "", resultFileId: f.resultFileId, width: f.width, height: f.height, formatKey: f.formatKey, canEdit: f.canEdit, layout: f.layoutConfig, chatUrl: f.chatUrl, reviewStatus: f.reviewStatus, reviewNote: f.reviewNote }}
      />
    );
  }
  return (
    <EditorClient
      ctx={ctx}
      initial={{
        id: f.id, name: f.name, campaign: f.campaign ?? "", formatKey: f.formatKey, width: f.width, height: f.height, version: f.version,
        canEdit: f.canEdit, ownerName: f.ownerName, isTemplate: f.isTemplate, doc: f.canvasState, products: f.products, layout: f.layoutConfig,
      }}
    />
  );
}
