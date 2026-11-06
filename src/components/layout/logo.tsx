/* eslint-disable @next/next/no-img-element */
/**
 * Logotipo oficial da plataforma (arquivo enviado pela Digitusul, sem alterações
 * na arte — apenas o enquadramento do SVG foi ajustado à área do desenho).
 * Sempre exibido sobre fundo claro para preservar as cores originais.
 */
export function HubLogo({ className = "h-7" }: { className?: string }) {
  return <img src="/brand/digitusul-hub-logo.svg" alt="Digitusul Hub" className={`${className} w-auto select-none`} draggable={false} />;
}
