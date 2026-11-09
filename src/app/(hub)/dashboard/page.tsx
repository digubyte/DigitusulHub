import { redirect } from "next/navigation";

/** Endereço antigo: a plataforma agora abre no Início do Hub. */
export default function OldDashboard() {
  redirect("/inicio");
}
