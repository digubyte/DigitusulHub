"use client";
import { useState } from "react";
import { api, Field, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export function PasswordForm() {
  const toast = useToast();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.next !== f.confirm) return toast.error("A confirmação não confere com a nova senha.");
    setBusy(true);
    try {
      await api("/api/me/password", { method: "POST", json: { current: f.current, next: f.next } });
      toast.success("Senha alterada.");
      setF({ current: "", next: "", confirm: "" });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-3">
      <h2 className="text-base font-bold sm:col-span-3">Alterar senha</h2>
      <Field label="Senha atual"><input className="input" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
      <Field label="Nova senha" hint="Mín. 10 caracteres, letras e números"><input className="input" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
      <Field label="Confirmar nova senha"><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      <div className="sm:col-span-3"><button className="btn-primary" disabled={busy || !f.current || !f.next}>{busy && <Spinner />}Salvar nova senha</button></div>
    </form>
  );
}
