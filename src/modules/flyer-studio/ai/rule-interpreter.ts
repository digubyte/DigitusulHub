/**
 * Interpretador determinístico de pedidos em português.
 * Usado quando a IA não está configurada (ou falha). Reconhece palavras-chave
 * de categoria, formato, cor de fundo, estilo e posição do logotipo.
 */
import { sanitizeSuggestion, type CompositionSuggestion } from "./suggestion";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const CATEGORY_RULES: [RegExp, CompositionSuggestion["category"]][] = [
  [/black\s*friday/, "blackfriday"],
  [/queima|liquida|ultimas unidades/, "queima"],
  [/reposi|de volta|voltou|chegou de novo|reabasteci/, "reposicao"],
  [/novidade|lancamento|lancou|chegou|novo produto|novos produtos/, "novidade"],
  [/institucional|comunicado|aviso|evento|servico|horario|feriado/, "institucional"],
  [/promo|oferta|desconto|preco baixo|imperdive/, "promocional"],
];

const FORMAT_RULES: [RegExp, string][] = [
  [/stor(y|ies)|status|9:16|1080\s*x\s*1920/, "ig-stories"],
  [/quadrad|1:1|1080\s*x\s*1080/, "ig-square"],
  [/feed|4:5|1080\s*x\s*1350/, "ig-feed"],
  [/banner.*site|site.*banner/, "site-banner"],
  [/banner|1920\s*x\s*600/, "banner"],
  [/a4.*(horizontal|paisagem)|(horizontal|paisagem).*a4/, "a4-landscape"],
  [/a4|impress|panfleto/, "a4-portrait"],
];

const COLOR_RULES: [RegExp, string][] = [
  [/fundo (azul escuro|marinho)/, "#0B1A4A"],
  [/fundo azul/, "#2341C1"],
  [/fundo vermelho/, "#E61F27"],
  [/fundo (preto|escuro)/, "#0A0D14"],
  [/fundo (branco|claro|limpo)/, "#FFFFFF"],
  [/fundo cinza/, "#F3F5FA"],
];

export function interpretPrompt(prompt: string): CompositionSuggestion {
  const p = norm(prompt);
  const notes: string[] = [];
  const category = CATEGORY_RULES.find(([re]) => re.test(p))?.[1] ?? null;
  const formatKey = FORMAT_RULES.find(([re]) => re.test(p))?.[1] ?? null;
  const backgroundColor = COLOR_RULES.find(([re]) => re.test(p))?.[1] ?? null;
  const style = /minimalista|clean|limpo|simples/.test(p) ? "minimal" : null;
  const logoPosition = /logo\w*\s+(no|ao)\s+(rodape|final|embaixo)/.test(p) ? "footer" : /logo\w*\s+(no|ao)\s+(topo|cabecalho|alto|cima)/.test(p) ? "header" : null;
  const emphasis = /precos? (em )?destaque|precos? destacad|destac\w* (os )?preco|precos? grandes?/.test(p) ? "price" : /destac\w* (o |os )?produto|foco no produto/.test(p) ? "product" : null;
  const showMascot = /sem (o )?(mascote|digu)/.test(p) ? false : /mascote|digu/.test(p) ? true : null;

  const qty = p.match(/(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+produtos?/);
  if (qty) notes.push(`Quantidade de produtos citada ("${qty[0]}") — os produtos sempre vêm do seu cadastro; adicione-os na etapa Produtos.`);
  if (!category) notes.push("Categoria não identificada no pedido — mantida a categoria selecionada.");
  notes.unshift("Pedido interpretado por regras (IA generativa não configurada).");

  return sanitizeSuggestion({ category, formatKey, backgroundColor, style, logoPosition, emphasis, showMascot, notes }, "rules");
}
