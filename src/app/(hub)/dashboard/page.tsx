import { redirect } from "next/navigation";

/** Endereço antigo: a plataforma agora abre direto no gerador de flyers. */
export default function OldDashboard() {
  redirect("/criar");
}
