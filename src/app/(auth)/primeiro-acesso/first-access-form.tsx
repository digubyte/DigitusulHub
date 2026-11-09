"use client";
import { useState } from "react";
import { api, Field, Spinner } from "@/components/ui/primitives";

export function FirstAccessForm() {
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirm) return setError("As senhas não coincidem.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/first-access", { method: "POST", json: { name: f.name, email: f.email, password: f.password } });
      window.location.href = "/inicio";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">{error}</p>}
      <Field label="Seu nome"><input className="input" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="E-mail do administrador"><input className="input" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Senha" hint="Mínimo de 10 caracteres, com letras e números."><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      <Field label="Confirme a senha"><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      <button className="btn-primary w-full py-2.5" disabled={busy || !f.name || !f.email || !f.password}>{busy && <Spinner />}Criar administrador e entrar</button>
    </form>
  );
}
