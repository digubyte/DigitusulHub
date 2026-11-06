"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { api, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

interface M { key: string; name: string; description: string; route: string; status: string; order: number; visible: boolean; core: boolean; implemented: boolean; permission: string }

export function ModulesAdmin({ initial }: { initial: M[] }) {
  const [mods, setMods] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const set = (i: number, patch: Partial<M>) => setMods((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => setMods((m) => {
    const a = [...m]; const j = i + d; if (j < 0 || j >= a.length) return a;
    [a[i], a[j]] = [a[j], a[i]]; return a.map((x, k) => ({ ...x, order: k * 10 }));
  });

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/modules", { method: "PUT", json: { modules: mods.map(({ key, name, status, order, visible }) => ({ key, name, status, order, visible })) } });
      toast.success("Configuração de módulos salva. O menu foi atualizado.");
      router.refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm text-ink-muted">
        Ordem, nome exibido, status e visibilidade de cada módulo no menu. Novos módulos são registrados em <code className="rounded bg-zinc-100 px-1">src/core/modules/registry.ts</code> e aparecem aqui automaticamente. Módulos sem implementação só podem ficar “Em desenvolvimento” ou “Desativado”.
      </p>
      <div className="card divide-y divide-zinc-100">
        {mods.map((m, i) => (
          <div key={m.key} className="grid items-center gap-3 p-4 md:grid-cols-[auto_1.2fr_1fr_auto_auto]">
            <div className="flex gap-1">
              <button className="btn-icon btn-ghost" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></button>
              <button className="btn-icon btn-ghost" aria-label="Descer" onClick={() => move(i, 1)} disabled={i === mods.length - 1}><ArrowDown className="h-4 w-4" /></button>
            </div>
            <div>
              <input className="input font-semibold" value={m.name} onChange={(e) => set(i, { name: e.target.value })} aria-label={`Nome do módulo ${m.key}`} />
              <p className="mt-1 text-xs text-ink-muted">{m.route} · permissão <code>{m.permission}</code>{m.core && " · núcleo"}</p>
            </div>
            <select className="input" value={m.status} disabled={m.core} onChange={(e) => set(i, { status: e.target.value })} aria-label="Status">
              {m.implemented && <option value="active">Ativo</option>}
              <option value="development">Em desenvolvimento</option>
              <option value="disabled">Desativado</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={m.visible} disabled={m.core} onChange={(e) => set(i, { visible: e.target.checked })} />Visível no menu</label>
            <span className="text-xs text-ink-muted">#{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />}Salvar alterações</button></div>
    </div>
  );
}
