import { HubLogo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-600 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-white/[0.06]" />
        <div aria-hidden className="absolute -bottom-40 -left-24 h-[24rem] w-[24rem] rounded-full bg-brand-950/30" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Plataforma interna</p>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white">A central de soluções da Digitusul.</h1>
          <p className="mt-4 text-base text-white/80">Ferramentas para Comercial, Marketing e Gestão em um só lugar — começando pelo Estúdio de Flyers.</p>
        </div>
        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} Digitusul</p>
      </section>
      <section className="flex items-center justify-center bg-white px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <HubLogo className="mb-10 h-9" />
          {children}
        </div>
      </section>
    </main>
  );
}
