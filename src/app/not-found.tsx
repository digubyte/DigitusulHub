import Link from "next/link";
import { HubLogo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center text-ink">
      <HubLogo className="h-6" />
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <p className="max-w-sm text-sm text-zinc-500">Esta página não existe ou foi removida (por exemplo, um lote que já foi excluído).</p>
      <Link href="/inicio" className="btn-primary">Voltar ao início</Link>
    </div>
  );
}
