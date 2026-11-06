"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { api, Field, Spinner } from "@/components/ui/primitives";

export function LoginForm({ next, notice }: { next: string; notice: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      window.location.href = next;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {notice && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">{error}</p>}
      <Field label="E-mail">
        <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Senha">
        <div className="relative">
          <input className="input pr-10" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="absolute inset-y-0 right-0 px-3 text-zinc-400 hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      <button className="btn-primary w-full py-2.5" disabled={busy || !email || !password}>{busy && <Spinner />}Entrar</button>
      <p className="text-center text-sm">
        <Link href="/recuperar-senha" className="font-medium text-brand-600 hover:underline">Esqueci minha senha</Link>
      </p>
    </form>
  );
}
