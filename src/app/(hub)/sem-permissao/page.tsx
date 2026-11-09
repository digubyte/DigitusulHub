import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";

export const metadata = { title: "Sem permissão" };

export default function NoPermission() {
  return (
    <EmptyState
      icon={<ShieldAlert className="h-10 w-10" />}
      title="Você não tem acesso a esta área"
      text="Se precisar deste recurso, solicite a liberação ao administrador da plataforma."
      action={<Link className="btn-primary" href="/inicio">Voltar ao início</Link>}
    />
  );
}
