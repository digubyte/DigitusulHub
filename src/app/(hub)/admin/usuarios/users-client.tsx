"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Lock, Plus, ShieldCheck, UserCog } from "lucide-react";
import { api, Field, Modal, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { relativeTime } from "@/core/util";

interface U { id: string; name: string; email: string; department: string | null; active: boolean; roleId: string; roleName: string; lastLoginAt: string | null; locked: boolean }
interface R { id: string; key: string; name: string; description: string | null; users: number; permissions: string[] }
interface P { key: string; module: string; description: string }

export function UsersAdmin() {
  const toast = useToast();
  const [users, setUsers] = useState<U[] | null>(null);
  const [roles, setRoles] = useState<R[]>([]);
  const [perms, setPerms] = useState<P[]>([]);
  const [editing, setEditing] = useState<Partial<U> & { password?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [roleEdit, setRoleEdit] = useState<R | null>(null);

  const load = useCallback(async () => {
    const [u, r] = await Promise.all([api<{ users: U[] }>("/api/admin/users"), api<{ roles: R[]; permissions: P[] }>("/api/admin/roles")]);
    setUsers(u.users); setRoles(r.roles); setPerms(r.permissions);
  }, []);
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      if (editing.id) {
        await api(`/api/admin/users/${editing.id}`, { method: "PATCH", json: { name: editing.name, roleId: editing.roleId, department: editing.department || null, active: editing.active } });
        toast.success("Usuário atualizado.");
      } else {
        await api("/api/admin/users", { method: "POST", json: { name: editing.name, email: editing.email, roleId: editing.roleId, department: editing.department || null, password: editing.password ?? "" } });
        toast.success("Usuário criado.");
      }
      setEditing(null);
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function genLink(u: U) {
    try {
      const r = await api<{ link: string }>(`/api/admin/users/${u.id}/reset-link`, { method: "POST" });
      setResetLink(r.link);
    } catch (e) { toast.error((e as Error).message); }
  }
  async function unlock(u: U) {
    try { await api(`/api/admin/users/${u.id}`, { method: "PATCH", json: { unlock: true } }); toast.success("Acesso desbloqueado."); load(); } catch (e) { toast.error((e as Error).message); }
  }
  async function saveRole() {
    if (!roleEdit) return;
    setBusy(true);
    try { await api(`/api/admin/roles/${roleEdit.id}`, { method: "PUT", json: { permissions: roleEdit.permissions } }); toast.success("Permissões atualizadas."); setRoleEdit(null); load(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (!users) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6 text-brand-600" /></div>;

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Usuários ({users.length})</h2>
          <button className="btn-primary" onClick={() => setEditing({ active: true, roleId: roles.find((r) => r.key === "COLABORADOR")?.id })}><Plus className="h-4 w-4" />Novo usuário</button>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Área</th><th className="px-4 py-3">Último acesso</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3"><p className="font-semibold text-ink">{u.name}</p><p className="text-xs text-ink-muted">{u.email}</p></td>
                  <td className="px-4 py-3">{u.roleName}</td>
                  <td className="px-4 py-3 text-ink-muted">{u.department || "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Nunca"}</td>
                  <td className="px-4 py-3">
                    {u.active ? <span className="badge bg-emerald-50 text-emerald-700">Ativo</span> : <span className="badge bg-zinc-100 text-zinc-500">Inativo</span>}
                    {u.locked && <span className="badge ml-1 bg-amber-50 text-amber-700">Bloqueado</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {u.locked && <button className="btn-ghost btn-sm" onClick={() => unlock(u)}><Lock className="h-3.5 w-3.5" />Desbloquear</button>}
                      <button className="btn-ghost btn-sm" onClick={() => genLink(u)}><KeyRound className="h-3.5 w-3.5" />Link de senha</button>
                      <button className="btn-ghost btn-sm" onClick={() => setEditing(u)}><UserCog className="h-3.5 w-3.5" />Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Perfis e permissões</h2>
        <p className="mb-3 text-sm text-ink-muted">As permissões são verificadas no servidor em cada página e requisição.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} className="card flex flex-col p-4">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-600" /><p className="font-semibold">{r.name}</p><span className="ml-auto text-xs text-ink-muted">{r.users} usuário(s)</span></div>
              <p className="mt-1 flex-1 text-sm text-ink-muted">{r.description}</p>
              <p className="mt-2 text-xs text-ink-muted">{r.permissions.length} de {perms.length} permissões</p>
              <button className="btn-secondary btn-sm mt-3" disabled={r.key === "ADMIN"} onClick={() => setRoleEdit({ ...r })}>{r.key === "ADMIN" ? "Acesso total (fixo)" : "Ajustar permissões"}</button>
            </div>
          ))}
        </div>
      </section>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar usuário" : "Novo usuário"} footer={
        <><button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />}Salvar</button></>
      }>
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo" className="sm:col-span-2"><input className="input" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="E-mail" className="sm:col-span-2"><input className="input" type="email" disabled={!!editing.id} value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
            <Field label="Perfil">
              <select className="input" value={editing.roleId ?? ""} onChange={(e) => setEditing({ ...editing, roleId: e.target.value })}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Área / equipe"><input className="input" value={editing.department ?? ""} onChange={(e) => setEditing({ ...editing, department: e.target.value })} placeholder="Ex.: Marketing" /></Field>
            {!editing.id && <Field label="Senha inicial" hint="Mínimo de 10 caracteres, com letras e números." className="sm:col-span-2"><input className="input" type="password" autoComplete="new-password" value={editing.password ?? ""} onChange={(e) => setEditing({ ...editing, password: e.target.value })} /></Field>}
            {editing.id && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />Usuário ativo (desativar encerra as sessões abertas)</label>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!resetLink} onClose={() => setResetLink(null)} title="Link de redefinição de senha" footer={<button className="btn-primary" onClick={() => setResetLink(null)}>Concluído</button>}>
        <p className="mb-3 text-sm text-ink-soft">Envie este link ao usuário por um canal seguro. Ele vale por 1 hora e só pode ser usado uma vez.</p>
        <div className="flex gap-2">
          <input readOnly className="input font-mono text-xs" value={resetLink ?? ""} onFocus={(e) => e.target.select()} />
          <button className="btn-secondary" onClick={() => { navigator.clipboard.writeText(resetLink ?? ""); toast.success("Link copiado."); }}><Copy className="h-4 w-4" /></button>
        </div>
      </Modal>

      <Modal size="lg" open={!!roleEdit} onClose={() => setRoleEdit(null)} title={`Permissões — ${roleEdit?.name ?? ""}`} footer={
        <><button className="btn-secondary" onClick={() => setRoleEdit(null)}>Cancelar</button><button className="btn-primary" onClick={saveRole} disabled={busy}>{busy && <Spinner />}Salvar permissões</button></>
      }>
        {roleEdit && ["core", "flyers"].map((mod) => (
          <fieldset key={mod} className="mb-4">
            <legend className="label uppercase tracking-wide">{mod === "core" ? "Plataforma" : "Estúdio de Flyers"}</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {perms.filter((p) => p.module === mod).map((p) => (
                <label key={p.key} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-zinc-50">
                  <input type="checkbox" className="mt-0.5" checked={roleEdit.permissions.includes(p.key)} onChange={(e) => setRoleEdit({ ...roleEdit, permissions: e.target.checked ? [...roleEdit.permissions, p.key] : roleEdit.permissions.filter((k) => k !== p.key) })} />
                  <span><span className="font-medium text-ink">{p.description}</span><span className="block font-mono text-[11px] text-ink-muted">{p.key}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </Modal>
    </div>
  );
}
