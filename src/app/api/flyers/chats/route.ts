import { apiRoute, jsonOk } from "@/core/http";
import { listChatsToDelete } from "@/modules/flyer-studio/services/chatgpt-service";

/** Fila de conversas do ChatGPT de flyers aprovados que ainda precisam ser apagadas. */
export const GET = apiRoute({ permission: "flyers.access" }, async ({ user }) => jsonOk({ chats: await listChatsToDelete(user) }));
