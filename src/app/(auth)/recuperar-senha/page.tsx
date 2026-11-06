"use client";
import { useState } from "react";
import Link from "next/link";
import { api, Field, Spinner } from "@/components/ui/primitives";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/forgot", { method: "POST", json: { email } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-2xl font-extrabold text-ink">Recuperar senha</h2>
      {sent ? (
        <div className="mt-4 space-y-4 text-sm text-ink-soft">
          <p>Se o e-mail estiver cadastrado, um link de redefinição foi gerado e vale por 1 hora.</p>
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-ink-muted">
            O envio automático de e-mails ainda não está configurado nesta instalação. Caso não receba o link, peça ao administrador para gerá-lo em Administração › Usuários.
          </p>
          <Link href="/login" className="btn-secondary w-full">Voltar ao login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <p role="alert" className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">{error}</p>}
          <Field label="E-mail cadastrado">
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <button className="btn-primary w-full py-2.5" disabled={busy || !email}>{busy && <Spinner />}Gerar link de redefinição</button>
          <p className="text-center text-sm"><Link href="/login" className="text-brand-600 hover:underline">Voltar ao login</Link></p>
        </form>
      )}
    </>
  );
}
