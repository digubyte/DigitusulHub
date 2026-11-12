/* eslint-disable @next/next/no-img-element */
/**
 * Logotipo oficial do Digitusul Hub (arquivo enviado pela Digitusul; só o enquadramento foi
 * recortado à área do desenho). No modo escuro, "DIGITUSUL" fica branco e "HUB" mantém o vermelho.
 */
export function HubLogo({ className = "h-7" }: { className?: string }) {
  return (
    <span className="inline-flex items-center">
      <img src="/brand/digitusul-hub-logo.svg" alt="Digitusul Hub" className={`${className} w-auto select-none dark:hidden`} draggable={false} />
      <img src="/brand/digitusul-hub-logo-dark.svg" alt="Digitusul Hub" className={`${className} hidden w-auto select-none dark:block`} draggable={false} />
    </span>
  );
}

/** Ícone "D" da Digitusul (quadrado). */
export function DigitusulIcon({ className = "h-6 w-6" }: { className?: string }) {
  return <img src="/brand/digitusul-icon.svg" alt="" aria-hidden className={`${className} select-none`} draggable={false} />;
}
