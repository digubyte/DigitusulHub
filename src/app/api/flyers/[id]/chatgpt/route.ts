import { z } from "zod";
import { apiRoute, jsonOk, parseBody } from "@/core/http";
import { ChatGptResultSchema } from "@/modules/flyer-studio/domain/schemas";
import { setChatGptResult, updateChatGptPrompt } from "@/modules/flyer-studio/services/chatgpt-service";

/** Salva a arte gerada (ou remove para gerar de novo). */
export const POST = apiRoute<{ id: string }>({ permission: "flyers.access" }, async ({ req, user, params }) => {
  const { fileId, checked, chatUrl } = await parseBody(req, ChatGptResultSchema);
  await setChatGptResult(user, params.id, fileId, checked, chatUrl);
  return jsonOk({ ok: true });
});

/** Edita o prompt (os dados dos produtos precisam continuar no texto). */
export const PUT = apiRoute<{ id: string }>({ permission: "flyers.access" }, async ({ req, user, params }) => {
  const { prompt } = await parseBody(req, z.object({ prompt: z.string().trim().min(40).max(20000) }));
  await updateChatGptPrompt(user, params.id, prompt);
  return jsonOk({ ok: true });
});
