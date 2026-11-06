import { apiRoute, jsonOk, parseBody } from "@/core/http";
import { ChatGptBatchSchema } from "@/modules/flyer-studio/domain/schemas";
import { createChatGptBatch } from "@/modules/flyer-studio/services/chatgpt-service";

/** Cria 1 flyer ou um lote a partir dos prompts aprovados pelo usuário. */
export const POST = apiRoute({ permission: "flyers.create" }, async ({ req, user }) => {
  const data = await parseBody(req, ChatGptBatchSchema);
  return jsonOk(await createChatGptBatch(user, data), 201);
});
