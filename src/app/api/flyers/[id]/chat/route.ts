import { apiRoute, jsonOk } from "@/core/http";
import { markChatDeleted } from "@/modules/flyer-studio/services/chatgpt-service";

/** Chamado depois de apagar a conversa no ChatGPT: remove o link do flyer. */
export const DELETE = apiRoute<{ id: string }>({ permission: "flyers.access" }, async ({ user, params }) => {
  await markChatDeleted(user, params.id);
  return jsonOk({ ok: true });
});
