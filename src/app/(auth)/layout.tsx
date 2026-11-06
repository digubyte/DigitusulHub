import { HubLogo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* brilho suave na cor da marca */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-18rem] h-[36rem] w-[56rem] -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl" />
      <div className="relative w-full max-w-[380px]">
        <HubLogo className="mx-auto mb-8 h-8" />
        <div className="card p-7 shadow-pop">{children}</div>
        <p className="mt-6 text-center text-xs text-zinc-400">Plataforma interna · © {new Date().getFullYear()} Digitusul</p>
      </div>
    </main>
  );
}
