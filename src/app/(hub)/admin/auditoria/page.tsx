import Link from "next/link";
import { requirePageUser } from "@/core/auth/session";
import { db } from "@/core/db";
import { ACTION_LABELS } from "@/core/audit";
import { formatDateTime } from "@/core/util";

export const metadata = { title: "Auditoria" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ acao?: string }> }) {
  await requirePageUser("audit.view");
  const { acao } = await searchParams;
  const rows = await db.activityLog.findMany({
    where: acao ? { action: acao } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { name: true, email: true } } },
  });
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Link href="/admin/auditoria" className={`badge px-3 py-1 ${!acao ? "bg-brand-600 text-white" : "bg-white text-ink-soft ring-1 ring-zinc-200"}`}>Todas</Link>
        {Object.entries(ACTION_LABELS).map(([k, v]) => (
          <Link key={k} href={`/admin/auditoria?acao=${k}`} className={`badge px-3 py-1 ${acao === k ? "bg-brand-600 text-white" : "bg-white text-ink-soft ring-1 ring-zinc-200"}`}>{v}</Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Detalhes</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-muted">Nenhum registro.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-2.5">{r.user?.name ?? <span className="text-ink-muted">—</span>}</td>
                <td className="px-4 py-2.5 font-medium">{ACTION_LABELS[r.action] ?? r.action}</td>
                <td className="max-w-md truncate px-4 py-2.5 font-mono text-xs text-ink-muted" title={r.metadata ?? ""}>{r.entityType ? `${r.entityType}:${r.entityId} ` : ""}{r.metadata}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-muted">Exibindo os 300 registros mais recentes.</p>
    </div>
  );
}
