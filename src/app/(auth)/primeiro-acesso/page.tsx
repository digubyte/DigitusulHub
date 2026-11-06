import { redirect } from "next/navigation";
import { needsFirstAccess } from "@/core/auth/first-access";
import { FirstAccessForm } from "./first-access-form";

export const metadata = { title: "Primeiro acesso" };
export const dynamic = "force-dynamic";

export default async function FirstAccessPage() {
  if (!(await needsFirstAccess())) redirect("/login");
  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight text-ink">Primeiro acesso</h2>
      <p className="mb-6 mt-1 text-sm text-ink-muted">Crie a conta do administrador da plataforma. Use o e-mail autorizado na configuração e escolha sua senha.</p>
      <FirstAccessForm />
    </>
  );
}
