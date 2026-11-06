import { requirePageUser } from "@/core/auth/session";
import { aiStatus } from "@/modules/flyer-studio/ai/claude";
import { getPricingRule } from "@/modules/flyer-studio/services/brand-service";
import { SITE_URL } from "@/modules/flyer-studio/catalog/catalog";
import { IntegrationsAdmin } from "./integrations-client";

export const metadata = { title: "Integrações" };

/** Status das integrações. As chaves NUNCA são enviadas ao navegador — apenas se estão configuradas. */
export default async function Page() {
  await requirePageUser("integrations.manage");
  const ai = aiStatus();
  const items = [
    { name: "IA generativa (Anthropic Claude)", env: "ANTHROPIC_API_KEY", ok: ai.enabled, detail: ai.enabled ? `Modelo ${ai.model}. Habilita “Criar com IA”, leitura de imagens de produtos e busca inteligente no catálogo.` : "Sem chave: “Criar com IA” usa o interpretador por regras; leitura de imagem e busca com IA ficam indisponíveis." },
    { name: "Remoção de fundo (remove.bg)", env: "REMOVE_BG_API_KEY", ok: !!process.env.REMOVE_BG_API_KEY, detail: "Remove o fundo de fotos de produtos, mantendo a original." },
    { name: "Catálogo do site Digitusul", env: "CATALOG_*", ok: true, detail: `Busca pública do e-commerce (${SITE_URL}). Usado para importar produtos com valor no cartão, imagem e código.` },
    { name: "Envio de e-mails", env: "—", ok: false, detail: "Não configurado. Links de redefinição de senha são gerados pelo administrador em Usuários." },
    { name: "Armazenamento de arquivos", env: "BLOB_READ_WRITE_TOKEN", ok: true, detail: process.env.BLOB_READ_WRITE_TOKEN ? "Vercel Blob (arquivos entregues somente pela plataforma, com sessão)." : "Disco local privado (desenvolvimento). Em produção na Vercel, conecte um Blob Store ao projeto." },
  ];
  return <IntegrationsAdmin items={items} pricing={await getPricingRule()} />;
}
