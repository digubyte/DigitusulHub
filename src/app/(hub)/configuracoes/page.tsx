import { requirePageUser } from "@/core/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requirePageUser();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Configurações" subtitle="Seu perfil e segurança da conta." />
      <section className="card mb-6 grid gap-4 p-5 sm:grid-cols-2">
        <div><p className="label">Nome</p><p className="font-medium">{user.name}</p></div>
        <div><p className="label">E-mail</p><p className="font-medium">{user.email}</p></div>
        <div><p className="label">Perfil de acesso</p><p className="font-medium">{user.roleName}</p></div>
        <div><p className="label">Área</p><p className="font-medium">{user.department || "—"}</p></div>
        <p className="text-xs text-ink-muted sm:col-span-2">Para alterar nome, área ou perfil, fale com um administrador.</p>
      </section>
      <PasswordForm />
    </div>
  );
}
