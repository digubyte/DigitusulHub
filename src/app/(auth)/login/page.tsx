import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/core/auth/session";
import { needsFirstAccess } from "@/core/auth/first-access";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ voltar?: string; expirada?: string; erro?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect("/inicio");
  // Plataforma recém-publicada, sem administrador: vai direto para o primeiro acesso.
  if (await needsFirstAccess()) redirect("/primeiro-acesso");
  const next = sp.voltar && sp.voltar.startsWith("/") && !sp.voltar.startsWith("//") ? sp.voltar : "/inicio";
  const notice = sp.expirada ? "Sua sessão expirou. Entre novamente." : sp.erro === "acesso" ? "Seu usuário não tem acesso à plataforma." : null;
  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight text-ink">Entrar</h2>
      <p className="mb-6 mt-1 text-sm text-ink-muted">Use seu e-mail corporativo e senha.</p>
      <LoginForm next={next} notice={notice} />
    </>
  );
}
