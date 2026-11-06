"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, Field, Spinner } from "@/components/ui/primitives";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setError("As senhas não coincidem.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset", { method: "POST", json: { token, password: pw } });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <p className="mt-4 text-sm text-accent-700">Link inválido. Solicite uma nova redefinição.</p>;
  if (done)
    return (
      <div className="mt-4 space-y-4">
        <p className="text-sm text-ink-soft">Senha redefinida. Todas as sessões anteriores foram encerradas.</p>
        <Link href="/login" className="btn-primary w-full">Entrar</Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {error && <p role="alert" className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">{error}</p>}
      <Field label="Nova senha" hint="Mínimo de 10 caracteres, com letras e números.">
        <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label="Confirme a nova senha">
        <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      <button className="btn-primary w-full py-2.5" disabled={busy || !pw}>{busy && <Spinner />}Salvar nova senha</button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <>
      <h2 className="font-display text-2xl font-extrabold text-ink">Definir nova senha</h2>
      <Suspense><ResetForm /></Suspense>
    </>
  );
}
