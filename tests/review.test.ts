import { describe, expect, it } from "vitest";
import { ChatGptResultSchema, ReviewSchema } from "@/modules/flyer-studio/domain/schemas";

describe("aprovação do flyer", () => {
  it("aceita aprovar e refazer sem texto", () => {
    expect(ReviewSchema.safeParse({ status: "approved" }).success).toBe(true);
    expect(ReviewSchema.safeParse({ status: "redo", note: null }).success).toBe(true);
  });
  it("exige texto ao pedir alterações", () => {
    expect(ReviewSchema.safeParse({ status: "changes" }).success).toBe(false);
    expect(ReviewSchema.safeParse({ status: "changes", note: "   " }).success).toBe(false);
    expect(ReviewSchema.safeParse({ status: "changes", note: "trocar o fundo para azul" }).success).toBe(true);
  });
  it("recusa status desconhecido", () => {
    expect(ReviewSchema.safeParse({ status: "publicado" }).success).toBe(false);
  });
  it("aceita só links de conversa do ChatGPT", () => {
    const ok = ChatGptResultSchema.safeParse({ fileId: "f1", checked: true, chatUrl: "https://chatgpt.com/c/abc123" });
    const bad = ChatGptResultSchema.safeParse({ fileId: "f1", checked: true, chatUrl: "https://exemplo.com/c/abc" });
    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
    expect(ChatGptResultSchema.safeParse({ fileId: "f1", checked: true }).success).toBe(true);
  });
});
