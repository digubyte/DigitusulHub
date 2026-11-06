import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/core/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ voltar?: string; expirada?: string; erro?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect("/dashboard");
  const next = sp.voltar && sp.voltar.startsWith("/") && !sp.voltar.startsWith("//") ? sp.voltar : "/dashboard";
  const notice = sp.expirada ? "Sua sessão expirou. Entre novamente." : sp.erro === "acesso" ? "Seu usuário não tem acesso à plataforma." : null;
  return (
    <>
      <h2 className="font-display text-2xl font-extrabold text-ink">Entrar</h2>
      <p className="mb-6 mt-1 text-sm text-ink-muted">Use seu e-mail corporativo e senha.</p>
      <LoginForm next={next} notice={notice} />
    </>
  );
}
